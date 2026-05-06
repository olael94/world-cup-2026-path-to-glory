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

K_FACTOR = 36


def _expected_win(he, ae, hr, ar) -> float:
    d = (he + (ar - hr) * 3.5) - ae
    return 1.0 / (1.0 + 10 ** (-d / 400))


def _poisson(lam, g):
    return (lam**g * exp(-lam)) / factorial(g)


def _exp_goals(te, tr, tf, oe, or_, of_) -> float:
    re = max(min((or_ - tr) / 55.0, 1.35), -1.35)
    ee = max(min((te - oe) / 600.0, 1.0), -1.0)
    fe = max(min((tf - of_) / 100.0, 0.5), -0.5)
    x = np.array([[re, ee, fe], [0, 0, 0], [0.9, 0.5, 0.2], [-0.9, -0.5, -0.2]])
    y = np.array([1.55 + re + ee + fe, 1.25, 2.15, 0.55])
    m = PoissonRegressor(alpha=0.05, max_iter=200).fit(x, np.clip(y, 0.2, 4.0))
    return float(np.clip(m.predict([[re, ee, fe]])[0], 0.2, 4.2))


def _pick_score(he, hr, hf, ae, ar, af) -> tuple[int, int]:
    hl = _exp_goals(he, hr, hf, ae, ar, af)
    al = _exp_goals(ae, ar, af, he, hr, hf)
    _, hg, ag = max(
        [(_poisson(hl, h) * _poisson(al, a), h, a) for h in range(6) for a in range(6)],
        key=lambda x: x[0],
    )
    return hg, ag


def _elo_update(he, hr, ae, ar, hg, ag):
    e = _expected_win(he, ae, hr, ar)
    act = 1.0 if hg > ag else 0.5 if hg == ag else 0.0
    s = K_FACTOR * (act - e)
    return round(s, 2), round(-s, 2), round(e, 4)


def simulate_group(
    group: GroupOrderDto,
    discipline: int,
    manual_scores: list[ManualScoreDto],
) -> tuple[list[GroupResultPayload], list[MatchResultPayload]]:
    ordered = sorted(group.slots, key=lambda s: s.position)
    teams = [s.team.model_copy() for s in ordered]
    pos = {s.team.id: s.position for s in ordered}
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
    raw.sort(
        key=lambda r: (-r.points, -r.goal_difference, -r.goals_for, -r.fair_play, pos[r.team_id])
    )
    standings = [r.model_copy(update={"position": i + 1}) for i, r in enumerate(raw)]
    return standings, matches_out


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
