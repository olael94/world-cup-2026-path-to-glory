"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Lock, RotateCcw, ShieldCheck, Trophy, Zap } from "lucide-react";
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

// Renders a single stat cell in the wildcard table with optional bold styling.
function StatCell({ value, strong = false }) {
    return (
        <span
            className={`text-center tabular-nums ${strong ? "font-black text-white" : "text-white/62"}`}
        >
            {value}
        </span>
    );
}

// Formats a goal difference number with a leading + for positive values.
function signed(value) {
    return value > 0 ? `+${value}` : value;
}

export function WildcardTable({ rows }) {
    const columns = ["P", "W", "D", "L", "Pts", "GF", "GA", "GD", "FP"];

    return (
        <section className="wildcard-section">
            <div className="mx-auto max-w-[1200px] px-8">
                <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                    <div className="section-masthead">
                        <span className="section-kicker">03 Wildcard race</span>
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
            <button
                className="bracket-scroll-hint"
                onClick={() =>
                    document
                        .getElementById("bracket-section")
                        ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
            >
                <ChevronDown size={18} className="bracket-scroll-hint-arrow" />
                <span>Full bracket below</span>
            </button>
        </section>
    );
}

// ─── Bracket ─────────────────────────────────────────────────────────────────

// Elo K-factor used for knockout matches — lower than the group stage (36)
// because a single knockout result should move ratings less dramatically.
const K_KNOCKOUT = 20;

// One color per fixture group in a round. Cycles if there are more groups than colors.
// Used to visually connect fixtures that feed into the same next-round match.
const PATH_COLORS_RGB = [
    "113, 229, 183", // mint
    "255, 177, 64", // amber
    "100, 160, 255", // blue
    "255, 100, 160", // pink
];

// Standard Elo win probability formula. Returns a number between 0 and 1.
// A result of 0.75 means team A has a 75% chance of beating team B.
function eloWinProbability(eloA, eloB) {
    return 1.0 / (1.0 + Math.pow(10, -(eloA - eloB) / 400));
}

export function RoundOf32({
    fixtures,
    mode = "simulation",
    momentumByTeam = {},
    eloByTeam = {},
    onReset,
}) {
    // Add a stable displayId to each fixture so we can key picks and refs by it,
    // since the backend matchNo alone isn't guaranteed to be sequential from 1.
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

    // User's bracket picks: { [displayId]: teamName }
    const [picks, setPicks] = useState({});
    // Tracks Elo momentum earned by each team as the user picks winners.
    // Also stores hidden "_shift_<displayId>" entries to allow undoing a pick's momentum.
    const [cumulativeMomentum, setCumulativeMomentum] = useState({});
    // Ref to the bracket container for measuring connector line positions.
    const bracketRef = useRef(null);
    // Ref map from displayId → DOM element, used to measure each fixture's position for connectors.
    const fixtureRefs = useRef(new Map());
    const [connectorPaths, setConnectorPaths] = useState([]);
    // Refs to each round column on mobile, used for auto-scrolling to the next round.
    const mobileRoundRefs = useRef([]);

    // Clear all picks when the fixture list changes (new simulation result loaded).
    // The eslint disable is needed because React's rules-of-hooks lint rule flags
    // setState calls inside useEffect, but this is intentional and safe here.
    /* eslint-disable react-hooks/set-state-in-effect */
    useEffect(() => {
        setPicks({});
        setCumulativeMomentum({});
    }, [roundOf32]);
    /* eslint-enable react-hooks/set-state-in-effect */

    // Rebuild the full bracket structure (rounds and which teams advance) whenever picks change.
    const bracketRounds = useMemo(() => buildBracketRounds(roundOf32, picks), [roundOf32, picks]);
    // Count how many fixtures are locked by real match data (shown in the subtitle).
    const lockedCount = useMemo(
        () =>
            bracketRounds.flatMap((round) => round.fixtures).filter((f) => isLockedFixture(f, mode))
                .length,
        [bracketRounds, mode]
    );

    // Handles picking or deselecting a winner for a fixture.
    // Clicking the already-picked team deselects it; clicking the other team swaps the pick.
    function selectWinner(fixture, teamName) {
        if (isLockedFixture(fixture, mode) || !canPickTeam(fixture, teamName)) return;

        const isDeselecting = picks[fixture.displayId] === teamName;

        setPicks((current) => {
            const next = { ...current };
            // Find all fixtures downstream that depend on this pick and clear them too,
            // so the bracket doesn't show an impossible path after a pick changes.
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
                // Undo: subtract the momentum shift we stored when this pick was made.
                // The "_shift_" key is a hidden entry used only for this reversal.
                const shift = prev[`_shift_${fixture.displayId}`] ?? 0;
                next[teamName] = parseFloat(((prev[teamName] ?? 0) - shift).toFixed(1));
                delete next[`_shift_${fixture.displayId}`];
            } else {
                // Calculate how much momentum the winner earns for beating this opponent.
                // An upset (low Elo beats high Elo) gives more momentum than an expected win.
                const loser = teamName === fixture.home ? fixture.away : fixture.home;
                const winnerElo = eloByTeam[teamName] ?? 1500;
                const loserElo = eloByTeam[loser] ?? 1500;
                const expected = eloWinProbability(winnerElo, loserElo);
                const shift = parseFloat((K_KNOCKOUT * (1.0 - expected)).toFixed(1));
                const base = prev[teamName] ?? momentumByTeam[teamName] ?? 0;
                next[teamName] = parseFloat((base + shift).toFixed(1));
                // Store the shift so we can reverse it if the user deselects this pick later.
                next[`_shift_${fixture.displayId}`] = shift;
            }
            return next;
        });

        // On mobile, automatically scroll to the next round column once all fixtures
        // in the current group are picked. Uses requestAnimationFrame so the DOM has
        // time to update before we measure scroll position.
        if (!isDeselecting && typeof window !== "undefined" && window.innerWidth < 1280) {
            const currentRoundIndex = bracketRounds.findIndex((r) =>
                r.fixtures.some((f) => f.displayId === fixture.displayId)
            );
            const currentRound = bracketRounds[currentRoundIndex];
            const nextRoundEl = mobileRoundRefs.current[currentRoundIndex + 1];

            if (nextRoundEl && currentRound) {
                // Round 1 has groups of 4 fixtures feeding one R16 slot; later rounds use groups of 2.
                const groupSize = currentRoundIndex === 0 ? 4 : 2;
                const fixtureIndex = currentRound.fixtures.findIndex(
                    (f) => f.displayId === fixture.displayId
                );
                const groupStart = Math.floor(fixtureIndex / groupSize) * groupSize;
                const group = currentRound.fixtures.slice(groupStart, groupStart + groupSize);

                const allGroupPicked = group.every(
                    (f) => f.winner || f.displayId === fixture.displayId || picks[f.displayId]
                );
                if (allGroupPicked) {
                    requestAnimationFrame(() => {
                        nextRoundEl.scrollIntoView({
                            behavior: "smooth",
                            inline: "start",
                            block: "nearest",
                        });
                    });
                }
            }
        }
    }

    // Handles drag-and-drop picks on the bracket.
    // A team can be dropped onto its own fixture (direct pick) or onto a later
    // fixture that lists the source fixture as a valid feeder (advance pick).
    function onFixtureDrop(fixture, event) {
        event.preventDefault();
        const payload = readDragPayload(event);
        if (!payload || isLockedFixture(fixture, mode)) return;

        if (payload.fixtureId === fixture.displayId) {
            // Dropped directly onto the fixture the team belongs to — treat as a click.
            selectWinner(fixture, payload.teamName);
            return;
        }

        if (fixture.sourceIds?.includes(payload.fixtureId)) {
            // Dropped onto a later round — find the original fixture and pick the winner there.
            const source = bracketRounds
                .flatMap((r) => r.fixtures)
                .find((f) => f.displayId === payload.fixtureId);
            if (source) selectWinner(source, payload.teamName);
        }
    }

    // useLayoutEffect runs after the DOM updates but before the browser paints,
    // which means we can measure element positions without a visible flicker.
    // Regular useEffect would cause connector lines to briefly appear in the wrong place.
    useLayoutEffect(() => {
        // Reads the screen position of every fixture card and calculates the SVG
        // path that draws a curved connector line from one fixture to the next round.
        function measureConnectors() {
            const bracketEl = bracketRef.current;
            if (!bracketEl) return;

            // All positions are relative to the bracket container, not the page,
            // so the SVG paths stay correct even if the page is scrolled.
            const bracketBox = bracketEl.getBoundingClientRect();
            const paths = [];

            bracketRounds.slice(0, -1).forEach((round, roundIndex) => {
                const nextRound = bracketRounds[roundIndex + 1];
                round.fixtures.forEach((fixture, fixtureIndex) => {
                    const sourceEl = fixtureRefs.current.get(fixture.displayId);
                    // Every pair of fixtures in round N feeds the same fixture in round N+1.
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

        // Measure once immediately after render, then again if the bracket resizes
        // (e.g. window resize, panel collapse) or the window size changes.
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

    // Merge group-stage momentum (from the simulation) with bracket-stage momentum (from picks).
    // The bracket picks override group-stage values for any team the user has advanced.
    // The filter removes the hidden "_shift_" tracking entries before passing to the UI.
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
        <section id="bracket-section" className="bracket-section mx-auto max-w-[1400px] px-8">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <div className="section-masthead">
                    <span className="section-kicker">04 Knockout route</span>
                    <h2>Path to Glory Bracket</h2>
                    <p>
                        {mode === "real"
                            ? `${lockedCount} completed fixtures locked by real data`
                            : "Drag or tap winners to route the bracket"}
                    </p>
                </div>
                <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-end sm:gap-3">
                    <span className="section-stat-pill">
                        Connectors light up when a winner advances
                    </span>
                    {onReset && (
                        <div className="flex flex-col items-start gap-1 sm:items-end">
                            <p className="reset-cta-note">Want to try a different scenario?</p>
                            <button className="reset-cta" onClick={onReset}>
                                <RotateCcw size={15} /> Reset the board
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div
                ref={bracketRef}
                className="bracket-frame flex snap-x snap-mandatory overflow-x-auto gap-4 pb-4 xl:grid xl:grid-cols-5 xl:gap-8 xl:overflow-visible xl:pb-0"
            >
                <svg className="bracket-connectors" aria-hidden="true">
                    {connectorPaths.map((path) => (
                        <path key={path.id} className={path.active ? "is-active" : ""} d={path.d} />
                    ))}
                </svg>

                {bracketRounds.map((round, roundIndex) => {
                    // roundSpan = how many grid rows this round's fixtures span.
                    // Round 1 fixtures span 1 row, round 2 span 2, round 3 span 4, etc.
                    const roundSpan = 2 ** roundIndex;
                    // Round 1 (R32) groups 4 fixtures per bracket section; all later rounds group 2.
                    const groupSize = roundIndex === 0 ? 4 : 2;

                    // For each fixture, determine if any team in its group has been picked.
                    // If so, return that team's group color style so all fixtures in the group
                    // glow with the same color — visually linking them as a path.
                    const groupGlowStyles = round.fixtures.map((_, i) => {
                        const gs = Math.floor(i / groupSize) * groupSize;
                        const group = round.fixtures.slice(gs, gs + groupSize);
                        const pickedWinner = group
                            .map((gf) => gf.winner || picks[gf.displayId])
                            .find(Boolean);
                        const team = pickedWinner ? teamByName[pickedWinner] : null;
                        return team ? groupStyle(team.group) : null;
                    });

                    // Count fixtures in this round that are part of an active path
                    // but haven't been picked yet — shown as the "N picks to advance" badge.
                    const pendingCount = round.fixtures.filter((f, i) => {
                        return groupGlowStyles[i] && !(f.winner || picks[f.displayId]);
                    }).length;

                    return (
                        <div
                            key={round.name}
                            ref={(node) => {
                                mobileRoundRefs.current[roundIndex] = node;
                            }}
                            className="w-full shrink-0 snap-start xl:w-auto xl:min-w-0"
                            data-round={roundIndex}
                        >
                            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase text-white/45">
                                {round.name}
                                {pendingCount > 0 && (
                                    <span className="bracket-pending-badge">
                                        {pendingCount} picks to advance
                                    </span>
                                )}
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
                                            // --fixture-start: which grid row this fixture starts on.
                                            // The Math.floor offset adds one extra row for every 4 fixture-rows
                                            // to account for the visual spacer rows between groups in the CSS grid.
                                            "--fixture-start":
                                                fixtureIndex * roundSpan +
                                                1 +
                                                Math.floor((fixtureIndex * roundSpan) / 4),
                                            "--fixture-span": roundSpan,
                                        }}
                                    >
                                        <FixtureCard
                                            fixture={fixture}
                                            userPick={picks[fixture.displayId]}
                                            pathGroupIndex={
                                                groupGlowStyles[fixtureIndex]
                                                    ? Math.floor(fixtureIndex / groupSize)
                                                    : null
                                            }
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

// Renders a single match card in the bracket with two team rows.
// fixture.winner = set by real data; userPick = set by the user clicking.
function FixtureCard({
    fixture,
    userPick,
    pathGroupIndex, // null if not part of any active path, otherwise the group index (0-3)
    isLocked,
    onDrop,
    onPick,
    momentumByTeam = {},
}) {
    // Real data winner takes priority over user pick.
    const winner = fixture.winner || userPick;
    const winnerTeam = teamByName[winner];
    // A fixture is undetermined when neither slot has been filled yet (both are still "TBD").
    const isUndetermined = !isConcreteTeam(fixture.home) && !isConcreteTeam(fixture.away);
    const isInPath = pathGroupIndex != null;
    // Pick a color from PATH_COLORS_RGB based on the group index, cycling if needed.
    const pathRgb = isInPath ? PATH_COLORS_RGB[pathGroupIndex % PATH_COLORS_RGB.length] : null;

    return (
        <div
            // preventDefault on dragOver is required to allow the onDrop event to fire.
            // Without it, the browser treats the target as non-droppable and cancels the drop.
            onDragOver={(event) => {
                if (!isLocked) event.preventDefault();
            }}
            onDrop={onDrop}
            className={`bracket-fixture-card rounded-md border bg-panel/80 p-3 ${
                winner ? "is-picked border-mint/55" : "border-line"
            } ${isLocked ? "opacity-70" : ""} ${isUndetermined ? "is-undetermined" : ""} ${
                isInPath ? "is-in-path" : ""
            }`}
            style={{
                ...(winnerTeam ? groupStyle(winnerTeam.group) : {}),
                ...(pathRgb ? { "--path-rgb": pathRgb } : {}),
            }}
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

// Renders one team row inside a fixture card — a button that doubles as a drag source.
function TeamPickRow({ fixtureId, name, isWinner, isLocked, onPick, momentum }) {
    // A team is only pickable if it's a real team (not "TBD") and the fixture isn't locked.
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
                // Two data formats: application/json for our own drop handler (structured data),
                // text/plain as a fallback for any other drop target that only reads plain text.
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
