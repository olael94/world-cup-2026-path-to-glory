from __future__ import annotations
from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field


class NewsItem(BaseModel):
    headline: str = ""
    source: str = ""
    relevance: str = ""
    url: str = ""
    model_config = {"populate_by_name": True}


class TeamDto(BaseModel):
    id: str
    name: str
    group: str
    ranking: int
    draw_order: int = Field(alias="drawOrder")
    elo: float
    form: float
    historical_matches: int = Field(alias="historicalMatches")
    ai_adjusted: bool = Field(False, alias="aiAdjusted")
    news_count: int = Field(0, alias="newsCount")
    intelligence_summary: str = Field("", alias="intelligenceSummary")
    intelligence_updated_at: Optional[str] = Field(None, alias="intelligenceUpdatedAt")
    news_items: list[NewsItem] = Field(default_factory=list, alias="newsItems")
    key_players_out: list[str] = Field(default_factory=list, alias="keyPlayersOut")
    key_players_in: list[str] = Field(default_factory=list, alias="keyPlayersIn")
    coach_notes: str = Field("", alias="coachNotes")
    model_config = {"populate_by_name": True}


class ManualScoreDto(BaseModel):
    group: str
    home_id: str = Field(alias="homeId")
    away_id: str = Field(alias="awayId")
    home_goals: int = Field(alias="homeGoals")
    away_goals: int = Field(alias="awayGoals")
    model_config = {"populate_by_name": True}


class RankingSlotDto(BaseModel):
    position: int = Field(ge=1, le=4)
    team: TeamDto


class GroupOrderDto(BaseModel):
    group: str
    slots: list[RankingSlotDto]


class SimulateRequest(BaseModel):
    snapshot_name: Optional[str] = Field(None, alias="snapshotName")
    discipline: int = Field(50, ge=0, le=100)
    groups: list[GroupOrderDto]
    manual_scores: list[ManualScoreDto] = Field(default_factory=list, alias="manualScores")
    model_config = {"populate_by_name": True}


class GroupResultPayload(BaseModel):
    team_id: str = Field(alias="teamId")
    team_name: str = Field(alias="teamName")
    group: str
    position: int
    played: int
    wins: int
    draws: int
    losses: int
    goals_for: int = Field(alias="goalsFor")
    goals_against: int = Field(alias="goalsAgainst")
    goal_difference: int = Field(alias="goalDifference")
    points: int
    fair_play: int = Field(alias="fairPlay")
    elo: float
    momentum_shift: float = Field(alias="momentumShift")
    model_config = {"populate_by_name": True}


class MatchResultPayload(BaseModel):
    group: str
    home_id: str = Field(alias="homeId")
    away_id: str = Field(alias="awayId")
    home_goals: int = Field(alias="homeGoals")
    away_goals: int = Field(alias="awayGoals")
    expected_home_win: float = Field(alias="expectedHomeWin")
    home_shift: float = Field(alias="homeShift")
    away_shift: float = Field(alias="awayShift")
    model_config = {"populate_by_name": True}


class GroupPayload(BaseModel):
    group: str
    standings: list[GroupResultPayload]
    matches: list[MatchResultPayload]


class WildcardStanding(BaseModel):
    team_id: str = Field(alias="teamId")
    team_name: str = Field(alias="teamName")
    group: str
    played: int
    wins: int
    draws: int
    losses: int
    points: int
    goals_for: int = Field(alias="goalsFor")
    goals_against: int = Field(alias="goalsAgainst")
    goal_difference: int = Field(alias="goalDifference")
    fair_play: int = Field(alias="fairPlay")
    elo: float
    momentum_shift: float = Field(alias="momentumShift")
    qualified: bool
    model_config = {"populate_by_name": True}


class BracketFixture(BaseModel):
    match_no: int = Field(alias="matchNo")
    home: str
    away: str
    venue: str
    model_config = {"populate_by_name": True}


class SimulateResponse(BaseModel):
    snapshot_id: Optional[UUID] = Field(None, alias="snapshotId")
    name: str
    created_at: Optional[datetime] = Field(None, alias="createdAt")
    groups: list[GroupPayload]
    wildcard_table: list[WildcardStanding] = Field(alias="wildcardTable")
    round_of32: list[BracketFixture] = Field(alias="roundOf32")
    model_config = {"populate_by_name": True}
