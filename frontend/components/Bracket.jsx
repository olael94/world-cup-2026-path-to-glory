"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Lock, ShieldCheck, Trophy, Zap } from "lucide-react";
import { CountryLabel } from "./CountryLabel";
import { groupStyle, teamByName } from "../lib/seedData";
import {
    buildBracketRounds,
    canPickTeam,
    connectorPath,
    descendantFixtureIds,
    isConcreteTeam,
    isLockedFixture,
    readDragPayload,
} from "../lib/bracket";

// ─── Wildcard Table ───────────────────────────────────────────────────────────

export function WildcardTable({ rows }) {
    const columns = ["P", "W", "D", "L", "Pts", "GF", "GA", "GD", "FP"];

    return (
        <section className="wildcard-section">
            <div className="mx-auto max-w-[1200px] px-8">
                <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                    <div className="section-masthead">
                        <span className="section-kicker">Wildcard race</span>
                        <h2>Third-Place Table</h2>
                        <p>
                            Top 8 third-place teams advance. Order uses Pts, GD, GF, then Fair Play.
                        </p>
                    </div>
                    <span className="section-stat-pill is-mint">
                        <ShieldCheck size={15} /> 8 Round of 32 spots
                    </span>
                </div>
                <div className="wildcard-table-wrap overflow-x-auto">
                    <div className="min-w-[860px]">
                        <div className="wildcard-table-header grid grid-cols-[3rem_minmax(15rem,1fr)_6rem_repeat(9,4rem)_8rem] items-center px-3 py-2 text-[0.68rem] font-black uppercase tracking-wide text-white/42">
                            <span>#</span>
                            <span>Team</span>
                            <span>Group</span>
                            {columns.map((col) => (
                                <span key={col} className="text-center">
                                    {col}
                                </span>
                            ))}
                            <span className="text-right">Status</span>
                        </div>
                        {rows.map((row, index) => (
                            <div
                                key={row.teamId}
                                className={`wildcard-row grid grid-cols-[3rem_minmax(15rem,1fr)_6rem_repeat(9,4rem)_8rem] items-center border-t border-line px-3 py-2 text-sm ${
                                    row.qualified ? "is-qualified" : ""
                                } ${index === 8 ? "is-cutline" : ""}`}
                                style={groupStyle(row.group)}
                            >
                                <span
                                    className={`wildcard-rank ${row.qualified ? "is-qualified" : ""}`}
                                >
                                    {index + 1}
                                </span>
                                <div className="min-w-0 pr-3">
                                    <div className="truncate font-semibold">
                                        <CountryLabel name={row.teamName} />
                                    </div>
                                    <div className="wildcard-subtext">Third place</div>
                                </div>
                                <span className="wildcard-group-pill justify-self-start">
                                    Group {row.group}
                                </span>
                                <StatCell value={row.played} />
                                <StatCell value={row.wins} />
                                <StatCell value={row.draws} />
                                <StatCell value={row.losses} />
                                <StatCell value={row.points} strong />
                                <StatCell value={row.goalsFor} />
                                <StatCell value={row.goalsAgainst} />
                                <StatCell value={signed(row.goalDifference)} strong />
                                <StatCell value={row.fairPlay} />
                                <span
                                    className={`wildcard-status justify-self-end ${row.qualified ? "is-qualified" : ""}`}
                                >
                                    {row.qualified ? "Advances" : "Out"}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}

function StatCell({ value, strong = false }) {
    return (
        <span
            className={`text-center tabular-nums ${strong ? "font-black text-white" : "text-white/62"}`}
        >
            {value}
        </span>
    );
}

function signed(value) {
    return value > 0 ? `+${value}` : value;
}

// ─── Bracket ─────────────────────────────────────────────────────────────────

const K_KNOCKOUT = 20;

function eloWinProbability(eloA, eloB) {
    return 1.0 / (1.0 + Math.pow(10, -(eloA - eloB) / 400));
}

export function RoundOf32({ fixtures, mode = "simulation", momentumByTeam = {}, eloByTeam = {} }) {
    const roundOf32 = useMemo(
        () =>
            fixtures.map((fixture, index) => ({
                ...fixture,
                displayId: `R32-${index + 1}`,
                fifaMatchNo: fixture.matchNo,
                sourceIds: [],
            })),
        [fixtures]
    );

    const [picks, setPicks] = useState({});
    const [cumulativeMomentum, setCumulativeMomentum] = useState({});
    const bracketRef = useRef(null);
    const fixtureRefs = useRef(new Map());
    const [connectorPaths, setConnectorPaths] = useState([]);

    /* eslint-disable react-hooks/set-state-in-effect */
    useEffect(() => {
        setPicks({});
        setCumulativeMomentum({});
    }, [roundOf32]);
    /* eslint-enable react-hooks/set-state-in-effect */

    const bracketRounds = useMemo(() => buildBracketRounds(roundOf32, picks), [roundOf32, picks]);
    const lockedCount = useMemo(
        () =>
            bracketRounds.flatMap((round) => round.fixtures).filter((f) => isLockedFixture(f, mode))
                .length,
        [bracketRounds, mode]
    );

    function selectWinner(fixture, teamName) {
        if (isLockedFixture(fixture, mode) || !canPickTeam(fixture, teamName)) return;

        const isDeselecting = picks[fixture.displayId] === teamName;

        setPicks((current) => {
            const next = { ...current };
            const affected = descendantFixtureIds(bracketRounds, fixture.displayId);
            if (isDeselecting) {
                delete next[fixture.displayId];
            } else {
                next[fixture.displayId] = teamName;
            }
            affected.forEach((id) => delete next[id]);
            return next;
        });

        setCumulativeMomentum((prev) => {
            const next = { ...prev };
            if (isDeselecting) {
                const shift = prev[`_shift_${fixture.displayId}`] ?? 0;
                next[teamName] = parseFloat(((prev[teamName] ?? 0) - shift).toFixed(1));
                delete next[`_shift_${fixture.displayId}`];
            } else {
                const loser = teamName === fixture.home ? fixture.away : fixture.home;
                const winnerElo = eloByTeam[teamName] ?? 1500;
                const loserElo = eloByTeam[loser] ?? 1500;
                const expected = eloWinProbability(winnerElo, loserElo);
                const shift = parseFloat((K_KNOCKOUT * (1.0 - expected)).toFixed(1));
                const base = prev[teamName] ?? momentumByTeam[teamName] ?? 0;
                next[teamName] = parseFloat((base + shift).toFixed(1));
                next[`_shift_${fixture.displayId}`] = shift;
            }
            return next;
        });
    }

    function onFixtureDrop(fixture, event) {
        event.preventDefault();
        const payload = readDragPayload(event);
        if (!payload || isLockedFixture(fixture, mode)) return;

        if (payload.fixtureId === fixture.displayId) {
            selectWinner(fixture, payload.teamName);
            return;
        }

        if (fixture.sourceIds?.includes(payload.fixtureId)) {
            const source = bracketRounds
                .flatMap((r) => r.fixtures)
                .find((f) => f.displayId === payload.fixtureId);
            if (source) selectWinner(source, payload.teamName);
        }
    }

    useLayoutEffect(() => {
        function measureConnectors() {
            const bracketEl = bracketRef.current;
            if (!bracketEl) return;

            const bracketBox = bracketEl.getBoundingClientRect();
            const paths = [];

            bracketRounds.slice(0, -1).forEach((round, roundIndex) => {
                const nextRound = bracketRounds[roundIndex + 1];
                round.fixtures.forEach((fixture, fixtureIndex) => {
                    const sourceEl = fixtureRefs.current.get(fixture.displayId);
                    const targetFixture = nextRound.fixtures[Math.floor(fixtureIndex / 2)];
                    const targetEl = targetFixture
                        ? fixtureRefs.current.get(targetFixture.displayId)
                        : null;
                    if (!sourceEl || !targetEl) return;

                    const sourceBox = sourceEl.getBoundingClientRect();
                    const targetBox = targetEl.getBoundingClientRect();
                    paths.push({
                        id: `${fixture.displayId}-${targetFixture.displayId}`,
                        active: Boolean(fixture.winner),
                        d: connectorPath(
                            sourceBox.right - bracketBox.left,
                            sourceBox.top + sourceBox.height / 2 - bracketBox.top,
                            targetBox.left - bracketBox.left,
                            targetBox.top + targetBox.height / 2 - bracketBox.top
                        ),
                    });
                });
            });
            setConnectorPaths(paths);
        }

        const frame = requestAnimationFrame(measureConnectors);
        const observer = new ResizeObserver(measureConnectors);
        if (bracketRef.current) observer.observe(bracketRef.current);
        window.addEventListener("resize", measureConnectors);

        return () => {
            cancelAnimationFrame(frame);
            observer.disconnect();
            window.removeEventListener("resize", measureConnectors);
        };
    }, [bracketRounds]);

    const displayMomentum = useMemo(
        () => ({
            ...momentumByTeam,
            ...Object.fromEntries(
                Object.entries(cumulativeMomentum).filter(([k]) => !k.startsWith("_"))
            ),
        }),
        [momentumByTeam, cumulativeMomentum]
    );

    return (
        <section className="bracket-section mx-auto max-w-[1400px] px-8">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <div className="section-masthead">
                    <span className="section-kicker">Knockout route</span>
                    <h2>Path to Glory Bracket</h2>
                    <p>
                        {mode === "real"
                            ? `${lockedCount} completed fixtures locked by real data`
                            : "Drag or tap winners to route the bracket"}
                    </p>
                </div>
                <span className="section-stat-pill">
                    Connectors light up when a winner advances
                </span>
            </div>

            <div ref={bracketRef} className="bracket-frame grid gap-4 xl:grid-cols-5 xl:gap-8">
                <svg className="bracket-connectors" aria-hidden="true">
                    {connectorPaths.map((path) => (
                        <path key={path.id} className={path.active ? "is-active" : ""} d={path.d} />
                    ))}
                </svg>

                {bracketRounds.map((round, roundIndex) => {
                    const roundSpan = 2 ** roundIndex;
                    return (
                        <div key={round.name} className="min-w-0" data-round={roundIndex}>
                            <h3 className="mb-2 text-sm font-semibold uppercase text-white/45">
                                {round.name}
                            </h3>
                            <div className="bracket-round-stack">
                                {round.fixtures.map((fixture, fixtureIndex) => (
                                    <div
                                        key={fixture.displayId}
                                        className="bracket-fixture-shell"
                                        ref={(node) => {
                                            if (node)
                                                fixtureRefs.current.set(fixture.displayId, node);
                                            else fixtureRefs.current.delete(fixture.displayId);
                                        }}
                                        style={{
                                            "--fixture-start": fixtureIndex * roundSpan + 1,
                                            "--fixture-span": roundSpan,
                                        }}
                                    >
                                        <FixtureCard
                                            fixture={fixture}
                                            isLocked={isLockedFixture(fixture, mode)}
                                            onDrop={(event) => onFixtureDrop(fixture, event)}
                                            onPick={(teamName) => selectWinner(fixture, teamName)}
                                            momentumByTeam={displayMomentum}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

// ─── Fixture card & team row ──────────────────────────────────────────────────

function FixtureCard({ fixture, isLocked, onDrop, onPick, momentumByTeam = {} }) {
    const winner = fixture.winner;
    const winnerTeam = teamByName[winner];

    return (
        <div
            onDragOver={(event) => {
                if (!isLocked) event.preventDefault();
            }}
            onDrop={onDrop}
            className={`bracket-fixture-card rounded-md border bg-panel/80 p-3 ${
                winner ? "is-picked border-mint/55" : "border-line"
            } ${isLocked ? "opacity-70" : ""}`}
            style={winnerTeam ? groupStyle(winnerTeam.group) : undefined}
        >
            <div className="mb-2 flex items-center justify-between gap-2 text-xs text-white/45">
                <span className="whitespace-nowrap">{fixture.displayId}</span>
                <span className="inline-flex min-w-0 items-center gap-1">
                    {isLocked ? <Lock size={12} /> : null}
                    {fixture.venue ? <span className="truncate">{fixture.venue}</span> : null}
                </span>
            </div>
            <div className="grid gap-1 text-sm font-semibold">
                <TeamPickRow
                    fixtureId={fixture.displayId}
                    name={fixture.home}
                    isWinner={winner === fixture.home}
                    isLocked={isLocked}
                    onPick={onPick}
                    momentum={momentumByTeam[fixture.home]}
                />
                <span className="text-white/35">vs</span>
                <TeamPickRow
                    fixtureId={fixture.displayId}
                    name={fixture.away}
                    isWinner={winner === fixture.away}
                    isLocked={isLocked}
                    onPick={onPick}
                    momentum={momentumByTeam[fixture.away]}
                />
            </div>
        </div>
    );
}

function TeamPickRow({ fixtureId, name, isWinner, isLocked, onPick, momentum }) {
    const pickable = isConcreteTeam(name) && !isLocked;
    const team = teamByName[name];
    const hasMomentum = momentum != null && momentum !== 0;

    return (
        <button
            type="button"
            draggable={pickable}
            disabled={!pickable}
            onClick={() => onPick(name)}
            onDragStart={(event) => {
                event.dataTransfer.setData(
                    "application/json",
                    JSON.stringify({ fixtureId, teamName: name })
                );
                event.dataTransfer.setData("text/plain", name);
            }}
            className={`bracket-team-row ${isWinner ? "is-winner" : ""}`}
            style={team ? groupStyle(team.group) : undefined}
            title={pickable ? `${isWinner ? "Deselect" : "Advance"} ${name}` : undefined}
        >
            <CountryLabel name={name} />
            <span className="bracket-team-row-right">
                {hasMomentum && (
                    <span
                        className={`bracket-momentum ${momentum > 0 ? "is-positive" : "is-negative"}`}
                    >
                        <Zap size={11} />
                        {momentum > 0 ? "+" : ""}
                        {momentum.toFixed(1)}
                    </span>
                )}
                {isWinner ? <Trophy size={14} /> : null}
            </span>
        </button>
    );
}
