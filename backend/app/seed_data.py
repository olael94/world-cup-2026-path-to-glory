from __future__ import annotations

import json
from pathlib import Path

from .models import TeamDto

_RATINGS_PATH = Path(__file__).parent / "data" / "historical-ratings.json"


def _load_ratings() -> dict:
    if _RATINGS_PATH.exists():
        return json.loads(_RATINGS_PATH.read_text()).get("teams", {})
    return {}


def _fallback_elo(ranking: int) -> float:
    return 1500 + max(0, 90 - ranking) * 4.0


def _make_team(id: str, name: str, group: str, ranking: int, draw_order: int) -> TeamDto:
    r = _RATINGS.get(id, {})
    return TeamDto(
        **{
            "id": id,
            "name": name,
            "group": group,
            "ranking": ranking,
            "drawOrder": draw_order,
            "elo": r.get("elo", _fallback_elo(ranking)),
            "form": r.get("form", 50.0),
            "historicalMatches": r.get("historicalMatches", 0),
            "aiAdjusted": False,
            "newsCount": 0,
            "intelligenceSummary": "",
            "intelligenceUpdatedAt": None,
        }
    )


_RATINGS = _load_ratings()

TEAMS: list[TeamDto] = [
    _make_team("mex", "Mexico", "A", 15, 1),
    _make_team("rsa", "South Africa", "A", 59, 2),
    _make_team("kor", "Korea Republic", "A", 22, 3),
    _make_team("cze", "Czechia", "A", 44, 4),
    _make_team("can", "Canada", "B", 31, 1),
    _make_team("bih", "Bosnia-Herzegovina", "B", 63, 2),
    _make_team("qat", "Qatar", "B", 34, 3),
    _make_team("sui", "Switzerland", "B", 19, 4),
    _make_team("bra", "Brazil", "C", 5, 1),
    _make_team("mar", "Morocco", "C", 14, 2),
    _make_team("hai", "Haiti", "C", 83, 3),
    _make_team("sco", "Scotland", "C", 38, 4),
    _make_team("usa", "USA", "D", 13, 1),
    _make_team("par", "Paraguay", "D", 48, 2),
    _make_team("aus", "Australia", "D", 26, 3),
    _make_team("tur", "Türkiye", "D", 27, 4),
    _make_team("ger", "Germany", "E", 9, 1),
    _make_team("cur", "Curaçao", "E", 90, 2),
    _make_team("civ", "Côte d'Ivoire", "E", 46, 3),
    _make_team("ecu", "Ecuador", "E", 24, 4),
    _make_team("ned", "Netherlands", "F", 7, 1),
    _make_team("jpn", "Japan", "F", 18, 2),
    _make_team("swe", "Sweden", "F", 29, 3),
    _make_team("tun", "Tunisia", "F", 41, 4),
    _make_team("bel", "Belgium", "G", 8, 1),
    _make_team("egy", "Egypt", "G", 32, 2),
    _make_team("irn", "IR Iran", "G", 20, 3),
    _make_team("nzl", "New Zealand", "G", 86, 4),
    _make_team("esp", "Spain", "H", 3, 1),
    _make_team("cpv", "Cabo Verde", "H", 65, 2),
    _make_team("ksa", "Saudi Arabia", "H", 57, 3),
    _make_team("uru", "Uruguay", "H", 11, 4),
    _make_team("fra", "France", "I", 2, 1),
    _make_team("sen", "Senegal", "I", 17, 2),
    _make_team("irq", "Iraq", "I", 56, 3),
    _make_team("nor", "Norway", "I", 28, 4),
    _make_team("arg", "Argentina", "J", 1, 1),
    _make_team("alg", "Algeria", "J", 37, 2),
    _make_team("aut", "Austria", "J", 25, 3),
    _make_team("jor", "Jordan", "J", 62, 4),
    _make_team("por", "Portugal", "K", 6, 1),
    _make_team("cod", "Congo DR", "K", 60, 2),
    _make_team("uzb", "Uzbekistan", "K", 58, 3),
    _make_team("col", "Colombia", "K", 12, 4),
    _make_team("eng", "England", "L", 4, 1),
    _make_team("cro", "Croatia", "L", 10, 2),
    _make_team("gha", "Ghana", "L", 60, 3),
    _make_team("pan", "Panama", "L", 43, 4),
]

TEAM_BY_ID: dict[str, TeamDto] = {t.id: t for t in TEAMS}
