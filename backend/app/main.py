from __future__ import annotations

import logging
import os
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .database import GroupResult, MatchResult, TournamentSnapshot, get_session, init_db
from .intelligence import current_teams
from .models import SimulateRequest, TeamDto
from .response_builders import seeded_response, to_response
from .seed_data import TEAM_BY_ID, TEAMS
from .simulation import simulate_group

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


@app.get("/snapshot/latest")
def latest_snapshot():
    session = get_session()
    try:
        snap = (
            session.query(TournamentSnapshot).order_by(TournamentSnapshot.created_at.desc()).first()
        )
        return to_response(snap) if snap else seeded_response()
    finally:
        session.close()


@app.post("/simulate")
def simulate(request: SimulateRequest):
    session = get_session()
    try:
        snap = TournamentSnapshot(name=request.snapshot_name or "Untitled Scenario")
        for group_order in request.groups:
            standings, matches = simulate_group(
                group_order, request.discipline, request.manual_scores
            )
            for s in standings:
                team = TEAM_BY_ID.get(s.team_id)
                snap.group_results.append(
                    GroupResult(
                        group_code=s.group,
                        team_id=s.team_id,
                        team_name=team.name if team else s.team_id,
                        position=s.position,
                        played=s.played,
                        wins=s.wins,
                        draws=s.draws,
                        losses=s.losses,
                        goals_for=s.goals_for,
                        goals_against=s.goals_against,
                        goal_difference=s.goal_difference,
                        points=s.points,
                        fair_play=s.fair_play,
                        elo=s.elo,
                        momentum_shift=s.momentum_shift,
                    )
                )
            for m in matches:
                snap.match_results.append(
                    MatchResult(
                        group_code=m.group,
                        home_id=m.home_id,
                        away_id=m.away_id,
                        home_goals=m.home_goals,
                        away_goals=m.away_goals,
                        expected_home_win=m.expected_home_win,
                        home_shift=m.home_shift,
                        away_shift=m.away_shift,
                    )
                )
        session.add(snap)
        session.commit()
        session.refresh(snap)
        return to_response(snap)
    except Exception as e:
        session.rollback()
        logger.error(f"Simulation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e
    finally:
        session.close()
