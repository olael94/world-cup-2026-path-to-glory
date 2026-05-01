from __future__ import annotations
import os, logging, threading
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from .models import SimulateRequest, SimulateResponse, GroupPayload, TeamDto
from .simulation import simulate_group, wildcard_table, round_of_32
from .intelligence import current_teams
from .database import init_db, get_session, TournamentSnapshot, GroupResult, MatchResult
from .seed_data import TEAMS, TEAM_BY_ID

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://path:glory@localhost:5432/path_to_glory")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

_teams_cache: list[TeamDto] = []
_teams_lock = threading.Lock()


def _load_teams_bg():
    logger.info("Loading team intelligence in background...")
    teams = current_teams(OPENAI_API_KEY)
    with _teams_lock:
        _teams_cache.clear()
        _teams_cache.extend(teams)
    logger.info(f"Team intelligence loaded: {sum(1 for t in teams if t.ai_adjusted)} AI-adjusted")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db(DATABASE_URL)
    logger.info("Database initialized")
    with _teams_lock:
        _teams_cache.extend(TEAMS)
    threading.Thread(target=_load_teams_bg, daemon=True).start()
    yield


app = FastAPI(title="Path to Glory API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/teams", response_model=list[TeamDto])
def teams():
    with _teams_lock:
        return list(_teams_cache)


@app.get("/snapshot/latest", response_model=SimulateResponse)
def latest_snapshot():
    session = get_session()
    try:
        snap = session.query(TournamentSnapshot).order_by(
            TournamentSnapshot.created_at.desc()).first()
        return _to_response(snap) if snap else _seeded_response()
    finally:
        session.close()


@app.post("/simulate", response_model=SimulateResponse)
def simulate(request: SimulateRequest):
    session = get_session()
    try:
        snap = TournamentSnapshot(name=request.snapshot_name or "Untitled Scenario")
        all_standings = []
        for group_order in request.groups:
            standings, matches = simulate_group(group_order, request.discipline, request.manual_scores)
            all_standings.extend(standings)
            for s in standings:
                team = TEAM_BY_ID.get(s.team_id)
                snap.group_results.append(GroupResult(
                    group_code=s.group, team_id=s.team_id,
                    team_name=team.name if team else s.team_id,
                    position=s.position, played=s.played, wins=s.wins,
                    draws=s.draws, losses=s.losses, goals_for=s.goals_for,
                    goals_against=s.goals_against, goal_difference=s.goal_difference,
                    points=s.points, fair_play=s.fair_play,
                    elo=s.elo, momentum_shift=s.momentum_shift,
                ))
            for m in matches:
                snap.match_results.append(MatchResult(
                    group_code=m.group, home_id=m.home_id, away_id=m.away_id,
                    home_goals=m.home_goals, away_goals=m.away_goals,
                    expected_home_win=m.expected_home_win,
                    home_shift=m.home_shift, away_shift=m.away_shift,
                ))
        session.add(snap)
        session.commit()
        session.refresh(snap)
        return _to_response(snap)
    except Exception as e:
        session.rollback()
        logger.error(f"Simulation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        session.close()


def _to_response(snap: TournamentSnapshot) -> SimulateResponse:
    from .models import GroupResultPayload, MatchResultPayload
    gmap: dict[str, tuple[list, list]] = {}
    for r in sorted(snap.group_results, key=lambda x: (x.group_code, x.position)):
        st, mt = gmap.setdefault(r.group_code, ([], []))
        st.append(GroupResultPayload(**{
            "teamId": r.team_id, "teamName": r.team_name, "group": r.group_code,
            "position": r.position, "played": r.played, "wins": r.wins,
            "draws": r.draws, "losses": r.losses, "goalsFor": r.goals_for,
            "goalsAgainst": r.goals_against, "goalDifference": r.goal_difference,
            "points": r.points, "fairPlay": r.fair_play,
            "elo": r.elo, "momentumShift": r.momentum_shift,
        }))
    for r in snap.match_results:
        st, mt = gmap.setdefault(r.group_code, ([], []))
        mt.append(MatchResultPayload(**{
            "group": r.group_code, "homeId": r.home_id, "awayId": r.away_id,
            "homeGoals": r.home_goals, "awayGoals": r.away_goals,
            "expectedHomeWin": r.expected_home_win,
            "homeShift": r.home_shift, "awayShift": r.away_shift,
        }))
    all_standings = [s for st, _ in gmap.values() for s in st]
    wc = wildcard_table(all_standings)
    r32 = round_of_32(all_standings, wc)
    return SimulateResponse(**{
        "snapshotId": snap.id, "name": snap.name, "createdAt": snap.created_at,
        "groups": [GroupPayload(group=g, standings=st, matches=mt)
                   for g, (st, mt) in sorted(gmap.items())],
        "wildcardTable": wc, "roundOf32": r32,
    })


def _seeded_response() -> SimulateResponse:
    from .models import GroupResultPayload
    gmap: dict[str, list] = {}
    for t in sorted(TEAMS, key=lambda t: (t.group, t.draw_order)):
        gmap.setdefault(t.group, []).append(GroupResultPayload(**{
            "teamId": t.id, "teamName": t.name, "group": t.group,
            "position": t.draw_order, "played": 0, "wins": 0, "draws": 0,
            "losses": 0, "goalsFor": 0, "goalsAgainst": 0, "goalDifference": 0,
            "points": 0, "fairPlay": 0, "elo": t.elo, "momentumShift": 0.0,
        }))
    return SimulateResponse(**{
        "snapshotId": None, "name": "Seeded Groups", "createdAt": None,
        "groups": [GroupPayload(group=g, standings=st, matches=[])
                   for g, st in sorted(gmap.items())],
        "wildcardTable": [], "roundOf32": [],
    })
