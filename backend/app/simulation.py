"""
Runs the group-stage simulation for the World Cup 2026 bracket.

Each match score is calculated using each team's Elo rating, FIFA ranking,
and recent form. After all group matches are played, it figures out which
third-place teams qualify and builds the round-of-32 bracket.
"""

from __future__ import annotations

from itertools import combinations
from math import exp, factorial

import numpy as np
from sklearn.linear_model import PoissonRegressor

from .models import (
    BracketFixture,
    GroupOrderDto,
    GroupResultPayload,
    ManualScoreDto,
    MatchResultPayload,
    WildcardStanding,
)

# Controls how much a win or loss changes a team's Elo rating.
# FIFA uses 36 for international matches — a bigger number means ratings move faster.
K_FACTOR = 36


def _expected_win(he, ae, hr, ar) -> float:
    """Calculates how likely the home team is to win based on both teams' Elo ratings and FIFA rankings.

    A team ranked lower (worse FIFA number) playing against a highly ranked team
    gets a small bonus to account for the ranking gap.
    """
    d = (he + (ar - hr) * 3.5) - ae
    return 1.0 / (1.0 + 10 ** (-d / 400))


def _poisson(lam, g):
    """Calculates the probability of a team scoring exactly g goals given their expected goals rate.

    Uses the Poisson formula, which is the standard math model for predicting goal counts in football.
    """
    return (lam**g * exp(-lam)) / factorial(g)


def _exp_goals(te, tr, tf, oe, or_, of_) -> float:
    """Predicts how many goals a team is likely to score in a match.

    Compares the two teams across three factors — FIFA ranking, Elo rating, and recent form.
    Each difference is capped so extreme mismatches don't produce absurd scores.
    The extra placeholder rows fed into the model keep predictions in a realistic range
    (roughly 0.2 to 4.2 goals) even when the teams are very evenly matched.
    """
    re = max(min((or_ - tr) / 55.0, 1.35), -1.35)
    ee = max(min((te - oe) / 600.0, 1.0), -1.0)
    fe = max(min((tf - of_) / 100.0, 0.5), -0.5)
    # The extra rows below are placeholder examples that keep the model grounded.
    # Without them, a single data point would produce unreliable predictions.
    x = np.array([[re, ee, fe], [0, 0, 0], [0.9, 0.5, 0.2], [-0.9, -0.5, -0.2]])
    y = np.array([1.55 + re + ee + fe, 1.25, 2.15, 0.55])
    m = PoissonRegressor(alpha=0.05, max_iter=200).fit(x, np.clip(y, 0.2, 4.0))
    return float(np.clip(m.predict([[re, ee, fe]])[0], 0.2, 4.2))


def _pick_score(he, hr, hf, ae, ar, af) -> tuple[int, int]:
    """Picks the most likely final score by testing every possible scoreline up to 5-5.

    For each combination of home and away goals, it calculates the probability of
    both happening at the same time, then returns whichever score has the highest probability.
    """
    hl = _exp_goals(he, hr, hf, ae, ar, af)
    al = _exp_goals(ae, ar, af, he, hr, hf)
    _, hg, ag = max(
        [(_poisson(hl, h) * _poisson(al, a), h, a) for h in range(6) for a in range(6)],
        key=lambda x: x[0],
    )
    return hg, ag


def _elo_update(he, hr, ae, ar, hg, ag):
    """Updates both teams' Elo ratings after a match and returns how much each rating changed.

    The winning team gains points; the losing team loses the same amount.
    Result is encoded as: 1.0 = home win, 0.5 = draw, 0.0 = away win.
    """
    e = _expected_win(he, ae, hr, ar)
    act = 1.0 if hg > ag else 0.5 if hg == ag else 0.0
    s = K_FACTOR * (act - e)
    return round(s, 2), round(-s, 2), round(e, 4)


def simulate_group(
    group: GroupOrderDto,
    discipline: int,
    manual_scores: list[ManualScoreDto],
) -> tuple[list[GroupResultPayload], list[MatchResultPayload]]:
    """Simulates every match in a single group (round-robin) and returns the final standings.

    Each team plays every other team once. After each match, both teams' Elo ratings update
    immediately so the next match uses the updated numbers. If the user entered a score
    manually, that score is used instead of the model — but ratings still update based on it.
    """
    ordered = sorted(group.slots, key=lambda s: s.position)
    teams = [s.team.model_copy() for s in ordered]
    pos = {s.team.id: s.position for s in ordered}
    # Teams are sorted alphabetically so we can find a manual score regardless of which is home vs. away
    manual_map = {
        tuple(sorted((ms.home_id, ms.away_id))): ms
        for ms in manual_scores
        if ms.group == group.group
    }
    elos = {t.id: t.elo for t in teams}
    stats = {
        t.id: {
            "played": 0,
            "wins": 0,
            "draws": 0,
            "losses": 0,
            "gf": 0,
            "ga": 0,
            "pts": 0,
            # Fair-play starting score based on draw position — teams drawn earlier get a slightly
            # better score. Stored as a negative so the sort puts better teams first.
            "fp": -round((discipline / 100) * (5 - pos[t.id])),
            "ms": 0.0,
        }
        for t in teams
    }
    matches_out: list[MatchResultPayload] = []

    for home, away in combinations(teams, 2):
        key = tuple(sorted((home.id, away.id)))
        ms = manual_map.get(key)
        hp, ap = pos[home.id], pos[away.id]

        if ms:
            # The user may have entered this score with teams in a different order — swap goals if needed
            hg = ms.home_goals if ms.home_id == home.id else ms.away_goals
            ag = ms.away_goals if ms.home_id == home.id else ms.home_goals
        else:
            ehg, eag = _pick_score(
                elos[home.id],
                home.ranking,
                home.form,
                elos[away.id],
                away.ranking,
                away.form,
            )
            # When the model predicts the same score for both outcomes, the better-drawn
            # team wins. This ensures there's always a clear result.
            if hp < ap:
                hg = max(ehg, eag + 1)
                ag = min(eag, hg - 1)
            elif hp > ap:
                ag = max(eag, ehg + 1)
                hg = min(ehg, ag - 1)
            else:
                hg = ag = min(ehg, eag)

        hs, as_, ew = _elo_update(elos[home.id], home.ranking, elos[away.id], away.ranking, hg, ag)
        elos[home.id] = round(elos[home.id] + hs, 2)
        elos[away.id] = round(elos[away.id] + as_, 2)

        for tid, gf, ga, shift in ((home.id, hg, ag, hs), (away.id, ag, hg, as_)):
            s = stats[tid]
            s["played"] += 1
            s["gf"] += gf
            s["ga"] += ga
            s["ms"] += shift
            if gf > ga:
                s["wins"] += 1
                s["pts"] += 3
            elif gf == ga:
                s["draws"] += 1
                s["pts"] += 1
            else:
                s["losses"] += 1

        matches_out.append(
            MatchResultPayload(
                **{
                    "group": group.group,
                    "homeId": home.id,
                    "awayId": away.id,
                    "homeGoals": hg,
                    "awayGoals": ag,
                    "expectedHomeWin": ew,
                    "homeShift": hs,
                    "awayShift": as_,
                }
            )
        )

    raw = [
        GroupResultPayload(
            **{
                "teamId": t.id,
                "teamName": t.name,
                "group": group.group,
                "position": 0,
                "played": stats[t.id]["played"],
                "wins": stats[t.id]["wins"],
                "draws": stats[t.id]["draws"],
                "losses": stats[t.id]["losses"],
                "goalsFor": stats[t.id]["gf"],
                "goalsAgainst": stats[t.id]["ga"],
                "goalDifference": stats[t.id]["gf"] - stats[t.id]["ga"],
                "points": stats[t.id]["pts"],
                "fairPlay": stats[t.id]["fp"],
                "elo": elos[t.id],
                "momentumShift": round(stats[t.id]["ms"], 2),
            }
        )
        for t in teams
    ]
    # Sort by FIFA tiebreaker rules: points first, then goal difference, then total goals scored,
    # then fair play score, then original draw position as the last resort
    raw.sort(
        key=lambda r: (-r.points, -r.goal_difference, -r.goals_for, -r.fair_play, pos[r.team_id])
    )
    standings = [r.model_copy(update={"position": i + 1}) for i, r in enumerate(raw)]
    return standings, matches_out


# Each row is one round-of-32 match that uses a third-place wildcard team.
# The list of group letters shows which groups' third-place teams are allowed in that slot.
# Format: (match number, group of the home team, eligible groups for the wildcard, venue)
_THIRD_PLACE_SLOTS = [
    (74, "E", ["A", "B", "C", "D", "F"], "Boston Stadium"),
    (77, "I", ["C", "D", "F", "G", "H"], "New York New Jersey Stadium"),
    (79, "A", ["C", "E", "F", "H", "I"], "Mexico City Stadium"),
    (80, "L", ["E", "H", "I", "J", "K"], "Atlanta Stadium"),
    (81, "D", ["B", "E", "F", "I", "J"], "San Francisco Bay Area Stadium"),
    (82, "G", ["A", "E", "H", "I", "J"], "Seattle Stadium"),
    (85, "B", ["E", "F", "G", "I", "J"], "BC Place Vancouver"),
    (87, "K", ["D", "E", "I", "J", "L"], "Kansas City Stadium"),
]

_FIXED_R32 = [
    (73, "A", "runner", "B", "runner", "Los Angeles Stadium"),
    (75, "F", "winner", "C", "runner", "Estadio Monterrey"),
    (76, "C", "winner", "F", "runner", "Houston Stadium"),
    (78, "E", "runner", "I", "runner", "Dallas Stadium"),
    (83, "K", "runner", "L", "runner", "Toronto Stadium"),
    (84, "H", "winner", "J", "runner", "Los Angeles Stadium"),
    (86, "J", "winner", "H", "runner", "Miami Stadium"),
    (88, "D", "runner", "G", "runner", "Dallas Stadium"),
]


def wildcard_table(standings: list[GroupResultPayload]) -> list[WildcardStanding]:
    """Ranks all third-place finishers and marks the top 8 as qualified wildcards.

    FIFA 2026 has 12 groups, so 12 teams finish third — but only the best 8 advance.
    Teams are ranked using the same tiebreaker rules as the group stage.
    """
    thirds = sorted(
        [s for s in standings if s.position == 3],
        key=lambda r: (-r.points, -r.goal_difference, -r.goals_for, -r.fair_play),
    )
    return [
        WildcardStanding(
            **{
                "teamId": r.team_id,
                "teamName": r.team_name,
                "group": r.group,
                "played": r.played,
                "wins": r.wins,
                "draws": r.draws,
                "losses": r.losses,
                "points": r.points,
                "goalsFor": r.goals_for,
                "goalsAgainst": r.goals_against,
                "goalDifference": r.goal_difference,
                "fairPlay": r.fair_play,
                "elo": r.elo,
                "momentumShift": r.momentum_shift,
                "qualified": i < 8,
            }
        )
        for i, r in enumerate(thirds)
    ]


def round_of_32(
    standings: list[GroupResultPayload],
    wildcards: list[WildcardStanding],
) -> list[BracketFixture]:
    """Builds the full round-of-32 bracket following the official FIFA 2026 match schedule.

    Some matches are fixed (e.g. Group A winner vs Group B runner-up) — those come from _FIXED_R32.
    The other 8 matches use the best available third-place wildcard teams, with each slot
    only accepting teams from specific groups as defined in _THIRD_PLACE_SLOTS.
    """
    W = {s.group: s for s in standings if s.position == 1}
    R = {s.group: s for s in standings if s.position == 2}
    T = {w.group: w for w in wildcards if w.qualified}
    fixtures: list[BracketFixture] = []

    for mn, hg, ht, ag, at, venue in _FIXED_R32:
        h = (W if ht == "winner" else R).get(hg)
        a = (W if at == "winner" else R).get(ag)
        fixtures.append(
            BracketFixture(
                **{
                    "matchNo": mn,
                    "home": h.team_name if h else "Pending",
                    "away": a.team_name if a else "Pending",
                    "venue": venue,
                }
            )
        )

    for mn, hg, accepted, venue in _THIRD_PLACE_SLOTS:
        third = next((T[g] for g in accepted if g in T), None)
        home = W.get(hg)
        fixtures.append(
            BracketFixture(
                **{
                    "matchNo": mn,
                    "home": home.team_name if home else "Pending",
                    "away": third.team_name if third else "Pending third-place qualifier",
                    "venue": venue,
                }
            )
        )

    return sorted(fixtures, key=lambda f: f.match_no)
