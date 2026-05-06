from __future__ import annotations

from .database import TournamentSnapshot
from .models import (
    GroupPayload,
    GroupResultPayload,
    MatchResultPayload,
    SimulateResponse,
)
from .seed_data import TEAMS
from .simulation import round_of_32, wildcard_table


def to_response(snap: TournamentSnapshot) -> SimulateResponse:
    gmap: dict[str, tuple[list, list]] = {}
    for r in sorted(snap.group_results, key=lambda x: (x.group_code, x.position)):
        st, mt = gmap.setdefault(r.group_code, ([], []))
        st.append(
            GroupResultPayload(
                **{
                    "teamId": r.team_id,
                    "teamName": r.team_name,
                    "group": r.group_code,
                    "position": r.position,
                    "played": r.played,
                    "wins": r.wins,
                    "draws": r.draws,
                    "losses": r.losses,
                    "goalsFor": r.goals_for,
                    "goalsAgainst": r.goals_against,
                    "goalDifference": r.goal_difference,
                    "points": r.points,
                    "fairPlay": r.fair_play,
                    "elo": r.elo,
                    "momentumShift": r.momentum_shift,
                }
            )
        )
    for r in snap.match_results:
        st, mt = gmap.setdefault(r.group_code, ([], []))
        mt.append(
            MatchResultPayload(
                **{
                    "group": r.group_code,
                    "homeId": r.home_id,
                    "awayId": r.away_id,
                    "homeGoals": r.home_goals,
                    "awayGoals": r.away_goals,
                    "expectedHomeWin": r.expected_home_win,
                    "homeShift": r.home_shift,
                    "awayShift": r.away_shift,
                }
            )
        )
    all_standings = [s for st, _ in gmap.values() for s in st]
    wc = wildcard_table(all_standings)
    r32 = round_of_32(all_standings, wc)
    return SimulateResponse(
        **{
            "snapshotId": snap.id,
            "name": snap.name,
            "createdAt": snap.created_at,
            "groups": [
                GroupPayload(group=g, standings=st, matches=mt)
                for g, (st, mt) in sorted(gmap.items())
            ],
            "wildcardTable": wc,
            "roundOf32": r32,
        }
    )


def seeded_response() -> SimulateResponse:
    gmap: dict[str, list] = {}
    for t in sorted(TEAMS, key=lambda t: (t.group, t.draw_order)):
        gmap.setdefault(t.group, []).append(
            GroupResultPayload(
                **{
                    "teamId": t.id,
                    "teamName": t.name,
                    "group": t.group,
                    "position": t.draw_order,
                    "played": 0,
                    "wins": 0,
                    "draws": 0,
                    "losses": 0,
                    "goalsFor": 0,
                    "goalsAgainst": 0,
                    "goalDifference": 0,
                    "points": 0,
                    "fairPlay": 0,
                    "elo": t.elo,
                    "momentumShift": 0.0,
                }
            )
        )
    return SimulateResponse(
        **{
            "snapshotId": None,
            "name": "Seeded Groups",
            "createdAt": None,
            "groups": [
                GroupPayload(group=g, standings=st, matches=[]) for g, st in sorted(gmap.items())
            ],
            "wildcardTable": [],
            "roundOf32": [],
        }
    )
