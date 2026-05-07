"""
Database table definitions and connection setup for saving simulation results.

Every time a simulation runs, the results are saved as a TournamentSnapshot
with the group standings and match scores stored as linked child records.
The frontend can then load the most recent snapshot or look one up by ID.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, create_engine
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Session, relationship, sessionmaker


class Base(DeclarativeBase):
    pass


class TournamentSnapshot(Base):
    __tablename__ = "tournament_snapshots"
    # Using a random ID instead of sequential numbers (1, 2, 3...) so IDs can't be guessed by anyone calling the API.
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False, default="Untitled Scenario")
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC))
    # When a snapshot is deleted, automatically delete all its group results and match results too.
    group_results = relationship(
        "GroupResult", back_populates="snapshot", cascade="all, delete-orphan"
    )
    match_results = relationship(
        "MatchResult", back_populates="snapshot", cascade="all, delete-orphan"
    )


class GroupResult(Base):
    __tablename__ = "group_results"
    id = Column(Integer, primary_key=True, autoincrement=True)
    snapshot_id = Column(UUID(as_uuid=True), ForeignKey("tournament_snapshots.id"))
    group_code = Column(String)
    team_id = Column(String)
    team_name = Column(String)
    position = Column(Integer)
    played = Column(Integer, default=0)
    wins = Column(Integer, default=0)
    draws = Column(Integer, default=0)
    losses = Column(Integer, default=0)
    goals_for = Column(Integer, default=0)
    goals_against = Column(Integer, default=0)
    goal_difference = Column(Integer, default=0)
    points = Column(Integer, default=0)
    fair_play = Column(Integer, default=0)
    elo = Column(Float, default=1500.0)
    momentum_shift = Column(Float, default=0.0)
    snapshot = relationship("TournamentSnapshot", back_populates="group_results")


class MatchResult(Base):
    __tablename__ = "match_results"
    id = Column(Integer, primary_key=True, autoincrement=True)
    snapshot_id = Column(UUID(as_uuid=True), ForeignKey("tournament_snapshots.id"))
    group_code = Column(String)
    home_id = Column(String)
    away_id = Column(String)
    home_goals = Column(Integer)
    away_goals = Column(Integer)
    expected_home_win = Column(Float)
    home_shift = Column(Float)
    away_shift = Column(Float)
    snapshot = relationship("TournamentSnapshot", back_populates="match_results")


# Set once when the server starts and reused for every database call.
_engine = None
_SessionLocal = None


def init_db(database_url: str) -> None:
    """Connects to the database and creates any tables that don't exist yet.

    Safe to run on a database that already has data — it won't delete or overwrite anything.
    """
    global _engine, _SessionLocal
    _engine = create_engine(database_url)
    Base.metadata.create_all(_engine)
    _SessionLocal = sessionmaker(bind=_engine)


def get_session() -> Session:
    """Opens a new database connection. The caller must close it when done."""
    return _SessionLocal()
