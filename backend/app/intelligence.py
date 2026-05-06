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
BATCH_SIZE = 3  # Reduced from 6 so each team gets focused attention per API call


class NewsItem(BaseModel):
    headline: str = ""
    source: str = ""
    relevance: str = ""  # injury | form | tactical | morale | availability
    url: str = ""


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


TRUSTED_SOURCES = {s.lower() for s in [
    # Global
    "FIFA.com", "ESPN FC", "ESPN", "BBC Sport", "BBC Sport Football",
    "The Athletic", "Goal.com", "Transfermarkt", "Reuters", "Reuters Sports",
    "Associated Press", "Associated Press Sports", "Sky Sports", "Sky Sports Football",
    "OptaJoe", "WhoScored", "FourFourTwo", "AP",
    # UEFA
    "UEFA.com", "Marca", "AS.com", "L'Equipe", "Gazzetta dello Sport", "Kicker",
    "Football Italia", "The Guardian", "The Guardian Football", "Fabrizio Romano",
    "Voetbal International", "A Bola", "Record", "Record (Portugal)",
    # CONMEBOL
    "TyC Sports", "Ole.com.ar", "Globo Esporte", "Lance!", "El Comercio",
    "ESPN Deportes", "CONMEBOL.com", "ESPN",
    # CONCACAF
    "Concacaf.com", "The Equalizer Soccer", "Ives Soccer", "SBI Soccer",
    "Medio Tiempo", "Record (Mexico)", "CanadaSoccerNews",
    "Sportsnet", "TSN", "The Canadian Press",
    # CAF
    "BBC Africa Sport", "CAF Online", "CAFOnline.com", "cafonline.com",
    "KickOff", "Goal.com Africa", "SuperSport Africa", "SuperSport",
    "Futaa.com", "The Nation Sports", "Pan Africa Football",
    "Algérie Presse Service",
    # AFC
    "the-afc.com", "AFC.com", "Fox Sports Asia", "Goal.com Asia",
    "Yonhap Sports", "Nikkan Sports", "Gulf News Sport", "Saudi Gazette Sport",
    "Arab News", "Saudi Pro League", "Saudi Pro League Official Website",
    "UzDaily.uz", "Jordan Times",
    # OFC
    "oceaniafootball.com", "Stuff Sport", "Fox Sports Australia", "The Roar",
    # Other credible outlets that appeared in results
    "Al Jazeera", "Le Monde", "Swiss Football Association",
    "Inside World Football", "CNN Brasil", "The Washington Post",
    "El País", "Bundesliga", "HRT", "Croatia Week",
    "NFSBiH.ba", "Footy Headlines", "blue News", "Blick",
    "Egypt Today", "The Brussels Times", "beIN SPORTS",
    "7NEWS Australia", "News Ghana", "Jordan Pulse",
    "La Presse de Tunisie",
]}

TEAM_ALIASES: dict[str, set[str]] = {
    # Group A
    "mex": {"mexico", "el tri", "el tricolor", "tricolor", "los aztecas",
            "mexican", "selección mexicana", "seleccion mexicana",
            "selección de méxico", "seleccion de mexico"},
    "rsa": {"south africa", "bafana bafana", "bafana"},
    "kor": {"korea republic", "south korea", "korea",
            "taeguk warriors", "asian tigers"},
    "cze": {"czechia", "czech republic", "czech"},
    # Group B
    "can": {"canada", "canadian", "les rouges", "the reds"},
    "bih": {"bosnia", "bosnia-herzegovina", "bosnia and herzegovina",
            "bosnia & herzegovina", "zmajevi", "the dragons", "golden lilies"},
    "qat": {"qatar", "qatari", "the maroons", "maroons"},
    "sui": {"switzerland", "swiss", "la nati", "nati"},
    # Group C
    "bra": {"brazil", "brasil", "a canarinha", "canarinha",
            "seleção", "selecao", "a verde-amarela", "verde-amarela",
            "seleção brasileira", "selecao brasileira", "brazilian"},
    "mar": {"morocco", "moroccan", "atlas lions",
            "équipe du maroc", "equipe du maroc"},
    "hai": {"haiti", "haitian", "les grenadiers",
            "les bicolores", "grenadiers"},
    "sco": {"scotland", "scottish"},
    # Group D
    "usa": {"usa", "usmnt", "united states", "u.s.", "u.s.a.",
            "stars and stripes", "american", "us men", "us soccer"},
    "par": {"paraguay", "paraguayan", "la albirroja", "albirroja",
            "selección paraguaya", "seleccion paraguaya",
            "selección de paraguay", "seleccion de paraguay"},
    "aus": {"australia", "socceroos", "australian"},
    "tur": {"türkiye", "turkiye", "turkey", "turkish",
            "milli takım", "milli takim"},
    # Group E
    "ger": {"germany", "german", "die mannschaft", "mannschaft",
            "die nationalmannschaft", "nationalmannschaft", "dfb"},
    "cur": {"curaçao", "curacao"},
    "civ": {"côte d'ivoire", "cote d'ivoire", "ivory coast", "ivorian",
            "les éléphants", "les elephants", "elephants"},
    "ecu": {"ecuador", "ecuadorian", "la tri", "la tricolor",
            "selección ecuatoriana", "seleccion ecuatoriana",
            "selección de ecuador", "seleccion de ecuador"},
    # Group F
    "ned": {"netherlands", "dutch", "holland", "oranje",
            "het nederlands elftal"},
    "jpn": {"japan", "japanese", "samurai blue"},
    "swe": {"sweden", "swedish", "blågult", "blagult"},
    "tun": {"tunisia", "tunisian", "eagles of carthage",
            "équipe de tunisie", "equipe de tunisie"},
    # Group G
    "bel": {"belgium", "belgian", "red devils",
            "les diables rouges", "rode duivels"},
    "egy": {"egypt", "egyptian", "the pharaohs", "pharaohs"},
    "irn": {"iran", "ir iran", "iranian", "team melli"},
    "nzl": {"new zealand", "all whites", "kiwis"},
    # Group H
    "esp": {"spain", "spanish", "la roja", "la furia española",
            "la furia espanola", "la furia",
            "selección española", "seleccion española",
            "seleccion espanola", "la seleccion española",
            "la seleccion espanola"},
    "cpv": {"cabo verde", "cape verde", "tubarões azuis",
            "tubaraes azuis", "blue sharks", "crioulos"},
    "ksa": {"saudi arabia", "saudi", "green falcons"},
    "uru": {"uruguay", "uruguayan", "la celeste",
            "la garra charrúa", "la garra charrua",
            "selección uruguaya", "seleccion uruguaya",
            "selección de uruguay", "seleccion de uruguay"},
    # Group I
    "fra": {"france", "french", "les bleus", "les tricolores",
            "équipe de france", "equipe de france"},
    "sen": {"senegal", "senegalese", "lions of teranga",
            "teranga lions", "équipe du sénégal", "equipe du senegal"},
    "irq": {"iraq", "iraqi", "lions of mesopotamia",
            "usood al-rafidain"},
    "nor": {"norway", "norwegian", "landslaget"},
    # Group J
    "arg": {"argentina", "argentinian", "la albiceleste", "albiceleste",
            "los campeones del mundo",
            "selección argentina", "seleccion argentina",
            "selección de argentina", "seleccion de argentina"},
    "alg": {"algeria", "algerian", "les fennecs",
            "fennec foxes", "desert foxes",
            "équipe d'algérie", "equipe d'algerie"},
    "aut": {"austria", "austrian", "das team"},
    "jor": {"jordan", "jordanian", "al-nashama", "nashama"},
    # Group K
    "por": {"portugal", "portuguese", "a seleção", "a selecao",
            "a seleção das quinas", "navegadores",
            "seleção portuguesa", "selecao portuguesa"},
    "cod": {"congo dr", "dr congo", "democratic republic of congo",
            "les léopards", "les leopards", "leopards", "drc"},
    "uzb": {"uzbekistan", "uzbek", "white wolves"},
    "col": {"colombia", "colombian", "los cafeteros", "cafeteros",
            "selección colombiana", "seleccion colombiana",
            "selección de colombia", "seleccion de colombia"},
    # Group L
    "eng": {"england", "english", "three lions"},
    "cro": {"croatia", "croatian", "vatreni",
            "kockasti", "the chequered ones", "hrvatska"},
    "gha": {"ghana", "ghanaian", "black stars"},
    "pan": {"panama", "panamanian", "los canaleros", "canaleros",
            "selección panameña", "seleccion panamena",
            "selección de panamá", "seleccion de panama"},
}

# Players who retired before 2025 — should never appear in 2026 squad news
RETIRED_PLAYERS = {
    # Czech Republic
    "petr čech", "tomas rosicky", "tomáš rosický", "milan baros", "milan baroš",
    "pavel nedved", "pavel nedvěd",
    # Bosnia
    "miralem pjanic", "miralem pjanić", "asmir begovic", "asmir begović",
    # Canada
    "atiba hutchinson", "julian de guzman", "julian de guzmán",
    "dwayne de rosario",
    # Other commonly hallucinated retired players
    "xavi", "xavi hernandez", "xavi hernández", "iniesta", "andres iniesta", "andrés iniesta", "david villa", "carles puyol",
    "miroslav klose", "bastian schweinsteiger", "philipp lahm",
    "frank lampard", "steven gerrard", "john terry",
    "zlatan ibrahimovic", "zlatan ibrahimović",
    "didier drogba", "samuel eto'o",
    "ryan giggs", "paul scholes",
    "gianluigi buffon", "andrea pirlo", "daniele de rossi",
    "sergio ramos", "marcelo", "david luiz", "dani alves",
    "thomas muller", "thomas müller",
    "manuel neuer", "toni kroos", "mats hummels",
    "claudio bravo", "arturo vidal",
    "tim cahill", "mark schwarzer",
    "gerard pique", "gerard piqué",
    "david silva",
    "cesc fabregas", "cesc fàbregas",
    "walid regragui",
    "andres guardado", "andrés guardado",
    "javier hernandez", "javier hernández",
    "ryan giggs", "paul scholes", "michael owen",
    "diego godin", "diego godín",
    "yaya toure", "yaya touré",
    "ronaldinho",
    "kaka", "kaká",
}

# Generic boilerplate phrases that indicate a hallucinated headline
BOILERPLATE_PHRASES = {
    "squad selection process underway",
    "squad selection process begins",
    "training camp dates announced",
    "training camp dates set",
    "friendly matches confirmed",
    "friendly matches scheduled",
    "friendly matches announced",
    "tactical preparations underway",
    "tactical preparations begin",
    "squad injury updates",
    "preparation plans revealed",
    "world cup preparation plans",
    "squad morale high",
    "fan engagement",
    "media coverage",
}

# Verified coach and best sources per team — prevents hallucination of wrong coaches
TEAM_CONTEXT: dict[str, dict] = {
    "mex": {"coach": "Javier Aguirre",       "sources": "Medio Tiempo, Record (Mexico), ESPN Deportes, The Washington Post"},
    "rsa": {"coach": "Hugo Broos",            "sources": "KickOff, SuperSport Africa, CAF Online, FourFourTwo"},
    "kor": {"coach": "Hong Myung-bo",         "sources": "FIFA.com, FourFourTwo, Fox Sports Asia, Goal.com Asia"},
    "cze": {"coach": "Miroslav Koubek",       "sources": "FIFA.com, UEFA.com, FourFourTwo"},
    "can": {"coach": "Jesse Marsch",          "sources": "Sportsnet, TSN, The Canadian Press, FIFA.com"},
    "bih": {"coach": "Sergej Barbarez",       "sources": "UEFA.com, FIFA.com, FourFourTwo, Footy Headlines"},
    "qat": {"coach": "Julen Lopetegui",       "sources": "FIFA.com, Gulf News Sport, Saudi Gazette Sport"},
    "sui": {"coach": "Murat Yakin",           "sources": "Swiss Football Association, blue News, Blick, FIFA.com"},
    "bra": {"coach": "Carlo Ancelotti",       "sources": "Globo Esporte, Lance!, Inside World Football, CNN Brasil, FourFourTwo"},
    "mar": {"coach": "Mohamed Ouahbi",        "sources": "CAF Online, FIFA.com, Goal.com, FourFourTwo"},
    "hai": {"coach": "Sébastien Migné",       "sources": "FIFA.com, FourFourTwo, Concacaf.com"},
    "sco": {"coach": "Steve Clarke",          "sources": "BBC Sport, Sky Sports, The Guardian, FIFA.com"},
    "usa": {"coach": "Mauricio Pochettino",   "sources": "ESPN, AS.com, The Athletic, The Guardian"},
    "par": {"coach": "Gustavo Alfaro",        "sources": "ESPN Deportes, TyC Sports, CONMEBOL.com, FourFourTwo"},
    "aus": {"coach": "Tony Popovic",          "sources": "Fox Sports Australia, The Roar, 7NEWS Australia, FourFourTwo"},
    "tur": {"coach": "Vincenzo Montella",     "sources": "FIFA.com, FourFourTwo, Al Jazeera"},
    "ger": {"coach": "Julian Nagelsmann",     "sources": "Bundesliga, beIN SPORTS, FIFA.com, FourFourTwo"},
    "cur": {"coach": "Fred Rutten",           "sources": "FIFA.com, FourFourTwo, beIN SPORTS"},
    "civ": {"coach": "Emerse Faé",            "sources": "CAF Online, FIFA.com, FourFourTwo"},
    "ecu": {"coach": "Sebastián Beccacece",   "sources": "ESPN Deportes, CONMEBOL.com, The Guardian, FourFourTwo"},
    "ned": {"coach": "Ronald Koeman",         "sources": "UEFA.com, Voetbal International, The Athletic, FourFourTwo"},
    "jpn": {"coach": "Hajime Moriyasu",       "sources": "FIFA.com, FourFourTwo, Nikkan Sports, ESPN"},
    "swe": {"coach": "Graham Potter",         "sources": "UEFA.com, The Guardian, Sky Sports, FourFourTwo, The Washington Post"},
    "tun": {"coach": "Sabri Lamouchi",        "sources": "CAF Online, La Presse de Tunisie, Futaa.com, FourFourTwo"},
    "bel": {"coach": "Rudi Garcia",           "sources": "FIFA.com, The Brussels Times, FourFourTwo"},
    "egy": {"coach": "Hossam Hassan",         "sources": "Egypt Today, FIFA.com, CAF Online, FourFourTwo"},
    "irn": {"coach": "Amir Ghalenoei",        "sources": "FourFourTwo, Associated Press, The Washington Post, Al Jazeera"},
    "nzl": {"coach": "Darren Bazeley",        "sources": "FIFA.com, FourFourTwo, The Roar"},
    "esp": {"coach": "Luis de la Fuente",     "sources": "Marca, AS.com, FIFA.com, FourFourTwo"},
    "cpv": {"coach": "Bubista",               "sources": "FIFA.com, CAF Online, FourFourTwo"},
    "ksa": {"coach": "Hervé Renard",          "sources": "Arab News, Saudi Pro League, FourFourTwo"},
    "uru": {"coach": "Marcelo Bielsa",        "sources": "ESPN, AS.com, FourFourTwo, TyC Sports"},
    "fra": {"coach": "Didier Deschamps",      "sources": "Le Monde, L'Equipe, FIFA.com"},
    "sen": {"coach": "Pape Thiaw",            "sources": "CAF Online, FIFA.com, FourFourTwo"},
    "irq": {"coach": "Graham Arnold",         "sources": "The Guardian, FIFA.com, FourFourTwo, Le Monde"},
    "nor": {"coach": "Ståle Solbakken",       "sources": "FIFA.com, FourFourTwo, Goal.com, Le Monde"},
    "arg": {"coach": "Lionel Scaloni",        "sources": "TyC Sports, Ole.com.ar, ESPN Deportes, FourFourTwo"},
    "alg": {"coach": "Vladimir Petković",     "sources": "Algérie Presse Service, Pan Africa Football, CAF Online"},
    "aut": {"coach": "Ralf Rangnick",         "sources": "FIFA.com, FourFourTwo, UEFA.com"},
    "jor": {"coach": "Jamal Sellami",         "sources": "Jordan Times, Jordan Pulse, FIFA.com"},
    "por": {"coach": "Roberto Martínez",      "sources": "A Bola, Record, El País, FourFourTwo"},
    "cod": {"coach": "Sébastien Desabre",     "sources": "CAF Online, Sky Sports, FourFourTwo, FIFA.com"},
    "uzb": {"coach": "Fabio Cannavaro",       "sources": "UzDaily.uz, FIFA.com, FourFourTwo"},
    "col": {"coach": "Néstor Lorenzo",        "sources": "El País, ESPN Deportes, CONMEBOL.com, FourFourTwo"},
    "eng": {"coach": "Thomas Tuchel",         "sources": "BBC Sport, The Guardian, Sky Sports, FourFourTwo"},
    "cro": {"coach": "Zlatko Dalić",          "sources": "HRT, Croatia Week, FIFA.com, FourFourTwo"},
    "gha": {"coach": "Carlos Queiroz",        "sources": "News Ghana, CAF Online, FourFourTwo, FIFA.com"},
    "pan": {"coach": "Thomas Christiansen",   "sources": "FIFA.com, FourFourTwo, Concacaf.com, AS.com"},
}

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
                v for v in val
                if isinstance(v, str)
                and v.strip()
                and v.strip().upper() != "N/A"
                and v.strip().lower() != "player name - injury"
                and v.strip().lower() != "player name - suspension"
                and v.strip().lower() != "player name - squad selection"
                and not v.strip().lower().startswith("key players")
                and not any(w in v.lower() for w in ["killed", "dead", "died", "massacre", "murder",
                                                      "new coach", "head coach", "appointed coach",
                                                      "appointed head", "personal reasons", "departed",
                                                      "left the role", "resigned", "sacked",
                                                      "coaching appointment", "manager appointment"])
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
        is_venue = any(w in h_lower for w in ["estadio", "stadium", "venue", "capacity", "location"])
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
        if headline and headline not in seen and headline_prefix not in seen and relevance and _is_trusted(source) and not is_venue and not is_cross_team and not is_boilerplate:
            seen.add(headline)
            seen.add(headline_prefix)
            deduped.append(news)
        else:
            logger.debug(f"Dropped news item — untrusted/venue/cross-team/boilerplate/invalid: source='{source}' headline='{headline}'")
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
        p for p in item.get("keyPlayersIn", [])
        if player_name(p) not in out_names
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
    return ChatPromptTemplate.from_messages([
        ("system", (
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
            "{{\"teams\": [{{\n"
            "  \"id\": \"<exact team id>\",\n"
            "  \"formAdjustment\": <-10 to 10>,\n"
            "  \"eloAdjustment\": <-50 to 50>,\n"
            "  \"newsCount\": <must equal length of newsItems array>,\n"
            "  \"summary\": \"<two sentence overview of how this team is preparing for World Cup 2026>\",\n"
            "  \"confidence\": <0-1>,\n"
            "  \"newsItems\": [\n"
            "    {{\"headline\": \"<actual headline>\", \"source\": \"<trusted publication name>\", "
            "\"relevance\": \"<injury|form|tactical|morale|availability>\", "
            "\"url\": \"<full https:// URL to the actual article, or empty string if unavailable>\"}}\n"
            "  ],\n"
            "  \"keyPlayersOut\": [\"<player name> - <reason>\"],\n"
            "  \"keyPlayersIn\": [\"<player name> - <reason>\"],\n"
            "  \"coachNotes\": \"<tactical or coaching changes relevant to 2026 World Cup preparation>\"\n"
            "}}]}}\n"
            "formAdjustment and eloAdjustment are DELTAS on top of historical baselines.\n"
            "If you truly cannot find trusted news after searching, return newsCount: 0, "
            "confidence: 0.3, and empty arrays — never fabricate headlines or use banned sources."
        )),
        ("user", (
            "Today's date is May 2026. The FIFA World Cup 2026 starts in June 2026.\n"
            "Search for 4-6 current (2025-2026) news items per team from trusted football sources only. "
            "Each item must be exclusively about that specific team:\n"
            "{team_lines}"
        )),
    ])


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
    batches = [TEAMS[i:i + BATCH_SIZE] for i in range(0, len(TEAMS), BATCH_SIZE)]

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
        retry_ids = (
            {t.id for t in all_intel if t.news_count < 2} |
            {t.id for t in TEAMS if t.id not in fetched_ids}
        )
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
                    logger.info(f"  {team.name}: retry found nothing, keeping existing (attempt {attempt})")
            except Exception as e:
                logger.error(f"  Retry failed for {team.name}: {e}")

    # Final safety net — add empty placeholder for any team still missing after all retries
    fetched_ids = {t.id for t in all_intel}
    for team in [t for t in TEAMS if t.id not in fetched_ids]:
        logger.warning(f"Team {team.name} still missing after all retries — adding empty placeholder")
        all_intel.append(TeamIntel(id=team.id))

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