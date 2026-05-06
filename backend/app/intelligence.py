from __future__ import annotations

import json
import logging
from datetime import UTC, datetime, timedelta
from pathlib import Path

from langchain_core.output_parsers import JsonOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

from .intel_config import (
    BOILERPLATE_PHRASES,
    RETIRED_PLAYERS,
    TEAM_ALIASES,
    TEAM_CONTEXT,
    TRUSTED_SOURCES,
)
from .models import NewsItem, TeamDto
from .seed_data import TEAMS

logger = logging.getLogger(__name__)
CACHE_PATH = Path("data/team-intelligence-cache.json")
REFRESH_HOURS = 24
BATCH_SIZE = 3  # Reduced from 6 so each team gets focused attention per API call


class TeamIntel(BaseModel):
    id: str
    form_adjustment: float = Field(alias="formAdjustment", default=0.0)
    elo_adjustment: float = Field(alias="eloAdjustment", default=0.0)
    news_count: int = Field(alias="newsCount", default=0)
    summary: str = ""
    confidence: float = 0.5
    news_items: list[NewsItem] = Field(alias="newsItems", default_factory=list)
    key_players_out: list[str] = Field(alias="keyPlayersOut", default_factory=list)
    key_players_in: list[str] = Field(alias="keyPlayersIn", default_factory=list)
    coach_notes: str = Field(alias="coachNotes", default="")
    model_config = {"populate_by_name": True}


class IntelligenceCache(BaseModel):
    generated_at: datetime
    teams: list[TeamIntel]

    def is_fresh(self) -> bool:
        age = datetime.now(UTC) - self.generated_at.replace(tzinfo=UTC)
        return age < timedelta(hours=REFRESH_HOURS)

    def by_team_id(self) -> dict[str, TeamIntel]:
        return {t.id: t for t in self.teams}


def _read_cache() -> IntelligenceCache | None:
    if not CACHE_PATH.exists():
        return None
    try:
        return IntelligenceCache(**json.loads(CACHE_PATH.read_text()))
    except Exception:
        return None


def _write_cache(cache: IntelligenceCache) -> None:
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    CACHE_PATH.write_text(cache.model_dump_json(indent=2, by_alias=True))


def _apply(cache: IntelligenceCache | None) -> list[TeamDto]:
    if cache is None:
        return list(TEAMS)
    by_id = cache.by_team_id()
    result = []
    for team in TEAMS:
        intel = by_id.get(team.id)
        if intel is None:
            result.append(team)
            continue
        result.append(
            team.model_copy(
                update={
                    "elo": round(team.elo + intel.elo_adjustment, 2),
                    "form": round(max(0.0, min(100.0, team.form + intel.form_adjustment)), 2),
                    "ai_adjusted": True,
                    "news_count": intel.news_count,
                    "intelligence_summary": intel.summary,
                    "intelligence_updated_at": cache.generated_at.isoformat(),
                    "news_items": intel.news_items,
                    "key_players_out": intel.key_players_out,
                    "key_players_in": intel.key_players_in,
                    "coach_notes": intel.coach_notes,
                }
            )
        )
    return result


def _is_trusted(source: str) -> bool:
    return source.strip().lower() in TRUSTED_SOURCES


def _clean_intel(item: dict) -> dict:
    # Fix "N/A" strings in array fields
    for field in ("keyPlayersOut", "keyPlayersIn"):
        val = item.get(field, [])
        if not isinstance(val, list):
            item[field] = []
        else:
            item[field] = [
                v
                for v in val
                if isinstance(v, str)
                and v.strip()
                and v.strip().upper() != "N/A"
                and v.strip().lower() != "player name - injury"
                and v.strip().lower() != "player name - suspension"
                and v.strip().lower() != "player name - squad selection"
                and not v.strip().lower().startswith("key players")
                and not any(
                    w in v.lower()
                    for w in [
                        "killed",
                        "dead",
                        "died",
                        "massacre",
                        "murder",
                        "new coach",
                        "head coach",
                        "appointed coach",
                        "appointed head",
                        "personal reasons",
                        "departed",
                        "left the role",
                        "resigned",
                        "sacked",
                        "coaching appointment",
                        "manager appointment",
                    ]
                )
                and v.split(" - ")[0].strip().lower() not in RETIRED_PLAYERS
                and not any(ord(c) > 0x024F for c in v)
                and not any(w in v.lower() for w in ["lesión", "convocatoria", "부상", "복귀"])
            ]

    # Fix "N/A" in coachNotes
    if item.get("coachNotes", "").strip().upper() == "N/A":
        item["coachNotes"] = ""

    # Filter to trusted sources only, deduplicate headlines, drop empty source/relevance
    # Also drop venue/stadium articles that are not about team preparation
    seen: set[str] = set()
    deduped = []
    for news in item.get("newsItems", []):
        headline = news.get("headline", "").strip()
        source = news.get("source", "").strip()
        relevance = news.get("relevance", "").strip()
        h_lower = headline.lower()
        is_venue = any(
            w in h_lower for w in ["estadio", "stadium", "venue", "capacity", "location"]
        )
        is_boilerplate = any(phrase in h_lower for phrase in BOILERPLATE_PHRASES)
        team_id = item.get("id", "")
        team_aliases = TEAM_ALIASES.get(team_id, set())
        is_cross_team = (
            bool(team_aliases)
            and not any(alias in h_lower for alias in team_aliases)
            and "world cup: every team" not in h_lower
            and "every team to have qualified" not in h_lower
        )
        headline_prefix = " ".join(headline.lower().split()[:6])
        if (
            headline
            and headline not in seen
            and headline_prefix not in seen
            and relevance
            and _is_trusted(source)
            and not is_venue
            and not is_cross_team
            and not is_boilerplate
        ):
            seen.add(headline)
            seen.add(headline_prefix)
            deduped.append(news)
        else:
            logger.debug(
                f"Dropped news item — untrusted/venue/cross-team/boilerplate/invalid: "
                f"source='{source}' headline='{headline}'"
            )
    item["newsItems"] = deduped
    item["newsCount"] = len(deduped)

    # Deduplicate players by name prefix (before " - "), not full string
    # This catches cases like "Ali Majrashi - Injury recovery" vs "Ali Majrashi - Return from injury"
    def player_name(entry: str) -> str:
        return entry.split(" - ")[0].strip().lower()

    seen_names: set[str] = set()
    clean_out = []
    for p in item.get("keyPlayersOut", []):
        n = player_name(p)
        if n not in seen_names:
            seen_names.add(n)
            clean_out.append(p)
    item["keyPlayersOut"] = clean_out

    out_names = {player_name(p) for p in clean_out}
    item["keyPlayersIn"] = [
        p for p in item.get("keyPlayersIn", []) if player_name(p) not in out_names
    ]

    # Cap excessively long player lists — more than 6 is almost certainly hallucinated
    if len(item.get("keyPlayersOut", [])) > 6:
        item["keyPlayersOut"] = item["keyPlayersOut"][:6]
    if len(item.get("keyPlayersIn", [])) > 6:
        item["keyPlayersIn"] = item["keyPlayersIn"][:6]

    # Cap adjustments to prevent model hitting absolute limits
    item["formAdjustment"] = max(-7.0, min(7.0, float(item.get("formAdjustment", 0.0))))
    item["eloAdjustment"] = max(-35.0, min(35.0, float(item.get("eloAdjustment", 0.0))))

    return item


def _build_prompt() -> ChatPromptTemplate:
    return ChatPromptTemplate.from_messages(
        [
            (
                "system",
                (
                    "You are a football intelligence analyst for the FIFA World Cup 2026 simulator.\n"
                    "The FIFA World Cup 2026 has NOT happened yet. It will take place in June-July 2026 "
                    "in the USA, Canada, and Mexico.\n"
                    "Your job is to research how each national team is CURRENTLY preparing for the 2026 World Cup.\n\n"
                    "TRUSTED SOURCES ONLY — use the sources listed for each team in the team line below. "
                    "Only use publications you can verify are real football journalism outlets.\n\n"
                    "EXPLICITLY BANNED — never use these regardless of content:\n"
                    "YouTube, Reddit, Wikipedia, fan blogs, TV stations, government press offices, "
                    "individual social media accounts, ILoveQatar.net, DZWatch, China.org.cn, "
                    "US11FC.com, gtbkaphansports, Yarra Football Channel, or any source not listed above.\n\n"
                    "STRICT RULES:\n"
                    "1. Every news item MUST be directly about the specific national team listed — not about "
                    "opponents, rivals, or other countries. Skip any article that only mentions the team in passing.\n"
                    "2. All news must be from 2025 or 2026. The 2024 Copa América, 2024 Euros, and 2024 AFCON "
                    "are PAST events — do not report on them as future or upcoming.\n"
                    "3. Focus ONLY on World Cup 2026 preparation: recent form, qualifying results, friendlies, "
                    "injuries, squad selection, tactical changes, and coach decisions.\n"
                    "4. Each news item must have a non-empty headline, a non-empty trusted source, "
                    "and a relevance value from: injury | form | tactical | morale | availability.\n"
                    "5. Never include duplicate headlines — each headline must be unique.\n"
                    "6. keyPlayersOut and keyPlayersIn must be mutually exclusive.\n"
                    "7. Use empty arrays [] when there is nothing to report — never use 'N/A' as an array value.\n"
                    "8. newsCount must equal the exact number of items in the newsItems array.\n"
                    "9. For major nations (Argentina, France, Spain, Brazil, Germany, Portugal, Netherlands, "
                    "England, Japan, Uruguay, Norway, Sweden, Morocco, Senegal, Canada) you MUST find at least "
                    "3 news items — search harder before giving up.\n"
                    "10. Never include articles about stadium venues, match schedules, or tournament logistics — "
                    "only include news directly about the team's players, coaching, and preparation.\n"
                    "11. Never fabricate player injuries, deaths, or incidents. If you cannot find real news, "
                    "return empty arrays rather than inventing events.\n"
                    "12. keyPlayersOut and keyPlayersIn must only contain ACTIVE players currently playing in "
                    "2025-2026. Never list retired players — players like Petr Čech, Edin Džeko, Miralem Pjanić, "
                    "Zlatan Ibrahimović, Manuel Neuer, Toni Kroos, Gianluigi Buffon, Xavi, Iniesta, or any "
                    "player who retired before 2025 must not appear in these lists.\n"
                    "Also never list coaches or staff members in keyPlayersOut or keyPlayersIn — only players.\n"
                    "Never list more than 5 players in either array. If there are many injuries, list only the "
                    "most significant ones.\n"
                    "13. The coach name in coachNotes must be the CURRENT coach as of May 2026. Verify this — "
                    "do not guess or use outdated information.\n"
                    "14. Every headline must be a real, specific article title — never write generic headlines "
                    "like 'Squad Selection Process Underway', 'Training Camp Dates Announced', or "
                    "'Friendly Matches Confirmed'. If you cannot find a real headline, omit that item.\n\n"
                    "Return ONLY valid JSON (no markdown, no code fences) with this exact structure:\n"
                    '{{"teams": [{{\n'
                    '  "id": "<exact team id>",\n'
                    '  "formAdjustment": <-10 to 10>,\n'
                    '  "eloAdjustment": <-50 to 50>,\n'
                    '  "newsCount": <must equal length of newsItems array>,\n'
                    '  "summary": "<two sentence overview of how this team is preparing for World Cup 2026>",\n'
                    '  "confidence": <0-1>,\n'
                    '  "newsItems": [\n'
                    '    {{"headline": "<actual headline>", "source": "<trusted publication name>", '
                    '"relevance": "<injury|form|tactical|morale|availability>", '
                    '"url": "<full https:// URL to the actual article, or empty string if unavailable>"}}\n'
                    "  ],\n"
                    '  "keyPlayersOut": ["<player name> - <reason>"],\n'
                    '  "keyPlayersIn": ["<player name> - <reason>"],\n'
                    '  "coachNotes": "<tactical or coaching changes relevant to 2026 World Cup preparation>"\n'
                    "}}]}}\n"
                    "formAdjustment and eloAdjustment are DELTAS on top of historical baselines.\n"
                    "If you truly cannot find trusted news after searching, return newsCount: 0, "
                    "confidence: 0.3, and empty arrays — never fabricate headlines or use banned sources."
                ),
            ),
            (
                "user",
                (
                    "Today's date is May 2026. The FIFA World Cup 2026 starts in June 2026.\n"
                    "Search for 4-6 current (2025-2026) news items per team from trusted football sources only. "
                    "Each item must be exclusively about that specific team:\n"
                    "{team_lines}"
                ),
            ),
        ]
    )


def _fetch_batch(chain, teams) -> list[TeamIntel]:
    lines = "\n".join(
        f"- {t.name} (id:{t.id}, coach:{TEAM_CONTEXT.get(t.id, {}).get('coach', 'unknown')}, "
        f"sources:{TEAM_CONTEXT.get(t.id, {}).get('sources', 'FIFA.com')}, "
        f"confederation:{t.group}, FIFA#{t.ranking}, Elo:{t.elo:.1f}, form:{t.form:.1f})"
        for t in teams
    )
    result = chain.invoke({"team_lines": lines})
    intel_list = []
    for item in result.get("teams", []):
        try:
            item = _clean_intel(item)
            intel_list.append(TeamIntel(**item))
        except Exception as e:
            logger.warning(f"Skipping malformed intel item: {e}")
    return intel_list


def _refresh(api_key: str) -> IntelligenceCache:
    llm = ChatOpenAI(
        model="gpt-4.1-mini",
        api_key=api_key,
        temperature=0,
        use_responses_api=True,
    ).bind(tools=[{"type": "web_search_preview"}])

    chain = _build_prompt() | llm | JsonOutputParser()
    all_intel: list[TeamIntel] = []
    batches = [TEAMS[i : i + BATCH_SIZE] for i in range(0, len(TEAMS), BATCH_SIZE)]

    # Main pass
    for batch in batches:
        try:
            all_intel.extend(_fetch_batch(chain, batch))
        except Exception as e:
            logger.error(f"Batch refresh failed: {e}")

    # Retry pass — re-run teams with 0 news or missing, up to 3 attempts
    # IMPORTANT: only replace existing data if retry actually finds something
    MAX_RETRIES = 3
    for attempt in range(1, MAX_RETRIES + 1):
        fetched_ids = {t.id for t in all_intel}
        retry_ids = {t.id for t in all_intel if t.news_count < 2} | {
            t.id for t in TEAMS if t.id not in fetched_ids
        }
        if not retry_ids:
            break
        logger.info(f"Retry attempt {attempt}/{MAX_RETRIES} for {len(retry_ids)} teams")
        for team in [t for t in TEAMS if t.id in retry_ids]:
            try:
                retried = _fetch_batch(chain, [team])
                if retried and retried[0].news_count > 0:
                    # Only swap out existing data if retry actually returned something
                    all_intel = [t for t in all_intel if t.id != team.id]
                    all_intel.extend(retried)
                    logger.info(f"  {team.name}: {retried[0].news_count} items (attempt {attempt})")
                else:
                    logger.info(
                        f"  {team.name}: retry found nothing, keeping existing (attempt {attempt})"
                    )
            except Exception as e:
                logger.error(f"  Retry failed for {team.name}: {e}")

    # Final safety net — add empty placeholder for any team still missing after all retries
    fetched_ids = {t.id for t in all_intel}
    for team in [t for t in TEAMS if t.id not in fetched_ids]:
        logger.warning(
            f"Team {team.name} still missing after all retries — adding empty placeholder"
        )
        all_intel.append(TeamIntel(id=team.id))

    cache = IntelligenceCache(generated_at=datetime.now(UTC), teams=all_intel)
    _write_cache(cache)
    return cache


def current_teams(api_key: str | None = None) -> list[TeamDto]:
    cache = _read_cache()
    if cache and cache.is_fresh():
        logger.info("Using fresh intelligence cache")
        return _apply(cache)
    if api_key:
        logger.info("Refreshing team intelligence via LangChain + web_search_preview")
        try:
            cache = _refresh(api_key)
            logger.info(f"Refreshed {len(cache.teams)} teams")
        except Exception as e:
            logger.error(f"Intelligence refresh failed, using fallback: {e}")
    return _apply(cache)
