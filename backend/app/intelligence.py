from __future__ import annotations
import json, logging
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional
from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from .models import TeamDto
from .seed_data import TEAMS

logger = logging.getLogger(__name__)
CACHE_PATH = Path("data/team-intelligence-cache.json")
REFRESH_HOURS = 24
BATCH_SIZE = 6


class NewsItem(BaseModel):
    headline: str = ""
    source: str = ""
    relevance: str = ""  # injury | form | tactical | morale | availability


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
        age = datetime.now(timezone.utc) - self.generated_at.replace(tzinfo=timezone.utc)
        return age < timedelta(hours=REFRESH_HOURS)

    def by_team_id(self) -> dict[str, TeamIntel]:
        return {t.id: t for t in self.teams}


def _read_cache() -> Optional[IntelligenceCache]:
    if not CACHE_PATH.exists():
        return None
    try:
        return IntelligenceCache(**json.loads(CACHE_PATH.read_text()))
    except Exception:
        return None


def _write_cache(cache: IntelligenceCache) -> None:
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    CACHE_PATH.write_text(cache.model_dump_json(indent=2, by_alias=True))


def _apply(cache: Optional[IntelligenceCache]) -> list[TeamDto]:
    if cache is None:
        return list(TEAMS)
    by_id = cache.by_team_id()
    result = []
    for team in TEAMS:
        intel = by_id.get(team.id)
        if intel is None:
            result.append(team)
            continue
        result.append(team.model_copy(update={
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
        }))
    return result


def _refresh(api_key: str) -> IntelligenceCache:
    llm = ChatOpenAI(
        model="gpt-4.1-mini",
        api_key=api_key,
        temperature=0,
        use_responses_api=True,
    ).bind(tools=[{"type": "web_search_preview"}])

    parser = JsonOutputParser()

    prompt = ChatPromptTemplate.from_messages([
        ("system", (
            "You are a football intelligence analyst for a 2026 World Cup simulator.\n"
            "Use web search to find CURRENT conditions for each team.\n"
            "Prefer sources from the last 30 days.\n"
            "Return ONLY valid JSON (no markdown, no code fences) with this exact structure:\n"
            "{{\"teams\": [{{\n"
            "  \"id\": \"<exact team id>\",\n"
            "  \"formAdjustment\": <-10 to 10>,\n"
            "  \"eloAdjustment\": <-50 to 50>,\n"
            "  \"newsCount\": <int>,\n"
            "  \"summary\": \"<two sentence overview of current team condition>\",\n"
            "  \"confidence\": <0-1>,\n"
            "  \"newsItems\": [\n"
            "    {{\"headline\": \"<actual headline>\", \"source\": \"<publication>\", "
            "\"relevance\": \"<injury|form|tactical|morale|availability>\"}}\n"
            "  ],\n"
            "  \"keyPlayersOut\": [\"<player name> - <reason>\"],\n"
            "  \"keyPlayersIn\": [\"<player name> - <reason>\"],\n"
            "  \"coachNotes\": \"<tactical or coaching changes>\"\n"
            "}}]}}\n"
            "formAdjustment and eloAdjustment are DELTAS on top of historical baselines."
        )),
        ("user", "Search for {news_min}-{news_max} current news signals per team:\n{team_lines}"),
    ])

    chain = prompt | llm | parser
    all_intel: list[TeamIntel] = []
    batches = [TEAMS[i:i + BATCH_SIZE] for i in range(0, len(TEAMS), BATCH_SIZE)]

    for batch in batches:
        lines = "\n".join(
            f"- {t.name} (id:{t.id}, group:{t.group}, FIFA#{t.ranking}, Elo:{t.elo:.1f}, form:{t.form:.1f})"
            for t in sorted(batch, key=lambda t: (t.group, t.draw_order))
        )
        try:
            result = chain.invoke({"news_min": 4, "news_max": 6, "team_lines": lines})
            for item in result.get("teams", []):
                try:
                    all_intel.append(TeamIntel(**item))
                except Exception as e:
                    logger.warning(f"Skipping malformed intel item: {e}")
        except Exception as e:
            logger.error(f"Batch refresh failed: {e}")

    cache = IntelligenceCache(generated_at=datetime.now(timezone.utc), teams=all_intel)
    _write_cache(cache)
    return cache


def current_teams(api_key: Optional[str] = None) -> list[TeamDto]:
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