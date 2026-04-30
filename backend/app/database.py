from __future__ import annotations
import uuid
from datetime import datetime, timezone
from sqlalchemy import create_engine, Column, String, Integer, Float, DateTime, ForeignKey
from sqlalchemy.orm import DeclarativeBase, relationship, sessionmaker, Session
from sqlalchemy.dialects.postgresql import UUID


class Base(DeclarativeBase):
    pass


class TournamentSnapshot(Base):
    __tablename__ = "tournament_snapshots"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False, default="Untitled Scenario")
    created_at = Column(DateTime(timezone=True), nullable=False,
                        default=lambda: datetime.now(timezone.utc))
    group_results = relationship("GroupResult", back_populates="snapshot",
                                 cascade="all, delete-orphan")
    match_results = relationship("MatchResult", back_populates="snapshot",
                                 cascade="all, delete-orphan")


class GroupResult(Base):
    __tablename__ = "group_results"
    id = Column(Integer, primary_key=True, autoincrement=True)
    snapshot_id = Column(UUID(as_uuid=True), ForeignKey("tournament_snapshots.id"))
    group_code = Column(String); team_id = Column(String); team_name = Column(String)
    position = Column(Integer); played = Column(Integer, default=0)
    wins = Column(Integer, default=0); draws = Column(Integer, default=0)
    losses = Column(Integer, default=0); goals_for = Column(Integer, default=0)
    goals_against = Column(Integer, default=0); goal_difference = Column(Integer, default=0)
    points = Column(Integer, default=0); fair_play = Column(Integer, default=0)
    elo = Column(Float, default=1500.0); momentum_shift = Column(Float, default=0.0)
    snapshot = relationship("TournamentSnapshot", back_populates="group_results")


class MatchResult(Base):
    __tablename__ = "match_results"
    id = Column(Integer, primary_key=True, autoincrement=True)
    snapshot_id = Column(UUID(as_uuid=True), ForeignKey("tournament_snapshots.id"))
    group_code = Column(String); home_id = Column(String); away_id = Column(String)
    home_goals = Column(Integer); away_goals = Column(Integer)
    expected_home_win = Column(Float); home_shift = Column(Float); away_shift = Column(Float)
    snapshot = relationship("TournamentSnapshot", back_populates="match_results")


_engine = None
_SessionLocal = None


def init_db(database_url: str) -> None:
    global _engine, _SessionLocal
    _engine = create_engine(database_url)
    Base.metadata.create_all(_engine)
    _SessionLocal = sessionmaker(bind=_engine)


def get_session() -> Session:
    return _SessionLocal()
