#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
from collections import deque
from dataclasses import dataclass
from datetime import UTC, date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RESULTS_CSV = ROOT / "math-service" / "data" / "results.csv"
FRONTEND_OUT = ROOT / "frontend" / "lib" / "generated" / "historicalRatings.json"
BACKEND_OUT = ROOT / "backend" / "src" / "main" / "resources" / "historical-ratings.json"

BASE_ELO = 1500.0
HOME_ADVANTAGE = 55.0
CUTOFF_DATE = date(2026, 6, 1)


@dataclass(frozen=True)
class AppTeam:
    id: str
    display_name: str
    aliases: tuple[str, ...]


APP_TEAMS = [
    AppTeam("mex", "Mexico", ("Mexico",)),
    AppTeam("rsa", "South Africa", ("South Africa",)),
    AppTeam("kor", "Korea Republic", ("South Korea", "Korea Republic")),
    AppTeam("cze", "Czechia", ("Czech Republic", "Czechia",)),
    AppTeam("can", "Canada", ("Canada",)),
    AppTeam("bih", "Bosnia-Herzegovina", ("Bosnia and Herzegovina", "Bosnia-Herzegovina")),
    AppTeam("qat", "Qatar", ("Qatar",)),
    AppTeam("sui", "Switzerland", ("Switzerland",)),
    AppTeam("bra", "Brazil", ("Brazil",)),
    AppTeam("mar", "Morocco", ("Morocco",)),
    AppTeam("hai", "Haiti", ("Haiti",)),
    AppTeam("sco", "Scotland", ("Scotland",)),
    AppTeam("usa", "USA", ("United States", "USA")),
    AppTeam("par", "Paraguay", ("Paraguay",)),
    AppTeam("aus", "Australia", ("Australia",)),
    AppTeam("tur", "Türkiye", ("Turkey", "Türkiye")),
    AppTeam("ger", "Germany", ("Germany",)),
    AppTeam("cur", "Curaçao", ("Curaçao", "Curacao")),
    AppTeam("civ", "Côte d'Ivoire", ("Ivory Coast", "Côte d'Ivoire", "Cote d'Ivoire")),
    AppTeam("ecu", "Ecuador", ("Ecuador",)),
    AppTeam("ned", "Netherlands", ("Netherlands",)),
    AppTeam("jpn", "Japan", ("Japan",)),
    AppTeam("swe", "Sweden", ("Sweden",)),
    AppTeam("tun", "Tunisia", ("Tunisia",)),
    AppTeam("bel", "Belgium", ("Belgium",)),
    AppTeam("egy", "Egypt", ("Egypt",)),
    AppTeam("irn", "IR Iran", ("Iran", "IR Iran")),
    AppTeam("nzl", "New Zealand", ("New Zealand",)),
    AppTeam("esp", "Spain", ("Spain",)),
    AppTeam("cpv", "Cabo Verde", ("Cape Verde", "Cabo Verde")),
    AppTeam("ksa", "Saudi Arabia", ("Saudi Arabia",)),
    AppTeam("uru", "Uruguay", ("Uruguay",)),
    AppTeam("fra", "France", ("France",)),
    AppTeam("sen", "Senegal", ("Senegal",)),
    AppTeam("irq", "Iraq", ("Iraq",)),
    AppTeam("nor", "Norway", ("Norway",)),
    AppTeam("arg", "Argentina", ("Argentina",)),
    AppTeam("alg", "Algeria", ("Algeria",)),
    AppTeam("aut", "Austria", ("Austria",)),
    AppTeam("jor", "Jordan", ("Jordan",)),
    AppTeam("por", "Portugal", ("Portugal",)),
    AppTeam("cod", "Congo DR", ("DR Congo", "Congo DR")),
    AppTeam("uzb", "Uzbekistan", ("Uzbekistan",)),
    AppTeam("col", "Colombia", ("Colombia",)),
    AppTeam("eng", "England", ("England",)),
    AppTeam("cro", "Croatia", ("Croatia",)),
    AppTeam("gha", "Ghana", ("Ghana",)),
    AppTeam("pan", "Panama", ("Panama",)),
]

ALIAS_TO_ID = {alias: team.id for team in APP_TEAMS for alias in team.aliases}


def expected_score(elo_a: float, elo_b: float) -> float:
    return 1.0 / (1.0 + 10 ** ((elo_b - elo_a) / 400.0))


def tournament_weight(tournament: str) -> float:
    name = tournament.lower()
    if "world cup" in name and "qualification" not in name:
        return 1.55
    if "qualification" in name:
        return 1.25
    if any(key in name for key in ("copa", "euro", "african cup", "asian cup", "gold cup", "nations cup")):
        return 1.35
    if "friendly" in name:
        return 0.72
    return 1.0


def recency_weight(match_date: date, latest_date: date) -> float:
    years_old = max(0.0, (latest_date - match_date).days / 365.25)
    return 0.70 + 0.30 / (1.0 + years_old / 5.0)


def result_points(goals_for: int, goals_against: int) -> float:
    if goals_for > goals_against:
        return 3.0
    if goals_for == goals_against:
        return 1.0
    return 0.0


def parse_completed_rows() -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    with RESULTS_CSV.open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            if row["home_score"] == "NA" or row["away_score"] == "NA":
                continue
            match_date = datetime.strptime(row["date"], "%Y-%m-%d").date()
            if match_date >= CUTOFF_DATE:
                continue
            row["_date"] = match_date
            rows.append(row)
    return rows


def build_ratings() -> dict[str, object]:
    rows = parse_completed_rows()
    if not rows:
        raise RuntimeError(f"No completed rows found in {RESULTS_CSV}")

    latest_date = max(row["_date"] for row in rows)
    elos: dict[str, float] = {}
    match_counts: dict[str, int] = {}
    recent: dict[str, deque[dict[str, object]]] = {team.id: deque(maxlen=10) for team in APP_TEAMS}

    for row in sorted(rows, key=lambda item: item["_date"]):
        home = row["home_team"]
        away = row["away_team"]
        home_score = int(row["home_score"])
        away_score = int(row["away_score"])
        neutral = row["neutral"].upper() == "TRUE"

        home_elo = elos.get(home, BASE_ELO)
        away_elo = elos.get(away, BASE_ELO)
        adjusted_home = home_elo if neutral else home_elo + HOME_ADVANTAGE

        expected_home = expected_score(adjusted_home, away_elo)
        actual_home = 1.0 if home_score > away_score else 0.5 if home_score == away_score else 0.0
        margin = abs(home_score - away_score)
        margin_multiplier = 1.0 + min(margin, 5) * 0.13
        k = 24.0 * tournament_weight(row["tournament"]) * recency_weight(row["_date"], latest_date) * margin_multiplier
        shift = k * (actual_home - expected_home)

        elos[home] = home_elo + shift
        elos[away] = away_elo - shift
        match_counts[home] = match_counts.get(home, 0) + 1
        match_counts[away] = match_counts.get(away, 0) + 1

        home_id = ALIAS_TO_ID.get(home)
        away_id = ALIAS_TO_ID.get(away)
        if home_id:
            recent[home_id].append(
                {
                    "date": row["date"],
                    "opponent": away,
                    "goalsFor": home_score,
                    "goalsAgainst": away_score,
                    "points": result_points(home_score, away_score),
                }
            )
        if away_id:
            recent[away_id].append(
                {
                    "date": row["date"],
                    "opponent": home,
                    "goalsFor": away_score,
                    "goalsAgainst": home_score,
                    "points": result_points(away_score, home_score),
                }
            )

    teams: dict[str, dict[str, object]] = {}
    for team in APP_TEAMS:
        alias_elos = [elos[alias] for alias in team.aliases if alias in elos]
        alias_counts = [match_counts[alias] for alias in team.aliases if alias in match_counts]
        elo = alias_elos[-1] if alias_elos else BASE_ELO
        recent_matches = list(recent[team.id])
        if recent_matches:
            avg_points = sum(float(match["points"]) for match in recent_matches) / (len(recent_matches) * 3.0)
            avg_goal_diff = sum(int(match["goalsFor"]) - int(match["goalsAgainst"]) for match in recent_matches) / len(recent_matches)
            form = max(0.0, min(100.0, avg_points * 72.0 + 28.0 * ((avg_goal_diff + 2.0) / 4.0)))
        else:
            form = 50.0

        teams[team.id] = {
            "name": team.display_name,
            "elo": round(elo, 1),
            "form": round(form, 1),
            "historicalMatches": sum(alias_counts),
            "recentMatches": recent_matches[-5:],
        }

    return {
        "generatedAt": datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "source": "martj42/international_results results.csv",
        "sourceUrl": "https://github.com/martj42/international_results",
        "latestCompletedMatchDate": latest_date.isoformat(),
        "teams": teams,
    }


def main() -> None:
    ratings = build_ratings()
    FRONTEND_OUT.parent.mkdir(parents=True, exist_ok=True)
    BACKEND_OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(ratings, ensure_ascii=False, indent=2) + "\n"
    FRONTEND_OUT.write_text(payload, encoding="utf-8")
    BACKEND_OUT.write_text(payload, encoding="utf-8")
    print(f"Wrote {FRONTEND_OUT}")
    print(f"Wrote {BACKEND_OUT}")


if __name__ == "__main__":
    main()
