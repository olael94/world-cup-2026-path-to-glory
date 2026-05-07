// "use client" tells Next.js this component runs in the browser, not on the server.
// Required here because we use useState, useEffect, and browser events.
"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { motion } from "framer-motion";
import { ClipboardList, Eye, SlidersHorizontal, Trophy, Zap } from "lucide-react";
import { GroupBoard } from "../components/GroupBoard";
import { RoundOf32, WildcardTable } from "../components/Bracket";
import { MatchScores } from "../components/MatchScores";
import { AiScoreboard } from "../components/AiScoreboard";
import { ControlDock } from "../components/ControlDock";
import { fetchTeams, simulate } from "../lib/api";
import { groupStyle, initialOrders, mergeTeamIntelligence } from "../lib/seedData";
import { manualScorePayload, manualScorePayloadFromInputs } from "../lib/scores";
import { Tutorial } from "../components/Tutorial";
import { Footer } from "../components/Footer";
import { TeamIntelDrawer } from "../components/TeamIntelDrawer";

export default function Home() {
    // The current drag order of teams within each group.
    const [orders, setOrders] = useState(() => initialOrders());
    // AI-adjusted team data fetched from the backend on load.
    const [baseTeams, setBaseTeams] = useState(null);
    // Fair-play discipline slider value (0–100).
    const [discipline, setDiscipline] = useState(50);
    // "simulation" uses the AI model; "real" uses actual match data.
    const [dataMode, setDataMode] = useState("simulation");
    // Set of group letters the user has filtered to. null means show all groups.
    const [focusedGroups, setFocusedGroups] = useState(null);
    // Manual scores entered by the user, stored as state so the UI re-renders.
    const [manualScores, setManualScores] = useState({});
    // Incrementing this number forces MatchScores to remount and clear its inputs.
    const [scoreResetVersion, setScoreResetVersion] = useState(0);
    // Ref copy of manual scores for reading the latest values without waiting for a re-render.
    const manualScoresRef = useRef({});
    // The full simulation result returned by the backend after Calculate is pressed.
    const [snapshot, setSnapshot] = useState(null);
    const [showTutorial, setShowTutorial] = useState(false);
    const [error, setError] = useState(null);
    // useTransition marks the simulation as non-urgent so the UI stays responsive while it runs.
    const [isPending, startTransition] = useTransition();
    // The team whose intel drawer is currently open.
    const [selectedTeam, setSelectedTeam] = useState(null);

    // Fetch AI-adjusted team data from the backend when the page first loads.
    // The `cancelled` flag prevents updating state if the component unmounts
    // before the fetch finishes — avoids a "can't update unmounted component" error.
    useEffect(() => {
        let cancelled = false;
        void (async () => {
            try {
                const teams = mergeTeamIntelligence(await fetchTeams());
                if (!cancelled) {
                    setBaseTeams(teams);
                    setOrders(initialOrders(teams));
                    setSnapshot(null);
                }
            } catch {
                // Keep bundled historical ratings if the API is unavailable.
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    // Convert the snapshot's groups array into a Map keyed by group letter
    // so each GroupBoard can look up its result instantly instead of searching the array.
    const resultsByGroup = useMemo(
        () => new Map(snapshot?.groups.map((group) => [group.group, group]) ?? []),
        [snapshot]
    );
    // Only show groups the user has filtered to. If nothing is filtered, show everything.
    const visibleOrders = useMemo(
        () => (focusedGroups ? orders.filter((order) => focusedGroups.has(order.group)) : orders),
        [focusedGroups, orders]
    );
    const visibleGroupCount = focusedGroups?.size ?? orders.length;

    // Default parameters let other functions call runSimulation() with overrides
    // (e.g. passing new orders before state has updated) without repeating the logic.
    function runSimulation(
        nextOrders = orders,
        nextDiscipline = discipline,
        nextManualScores = manualScorePayloadFromInputs() ??
            manualScorePayload(manualScoresRef.current)
    ) {
        setError(null);
        startTransition(() => {
            void (async () => {
                try {
                    setSnapshot(await simulate(nextOrders, nextDiscipline, nextManualScores));
                } catch (err) {
                    setError(err instanceof Error ? err.message : "Simulation failed");
                }
            })();
        });
    }

    // Called when the user drags a team to a new position inside a group.
    // Rebuilds the slots array immutably and reassigns position numbers (1-based).
    // Clears the snapshot because the new order invalidates the previous result.
    function onDropTeam(groupCode, fromIndex, toIndex) {
        const next = orders.map((group) => {
            if (group.group !== groupCode) return group;
            const slots = [...group.slots];
            const [moved] = slots.splice(fromIndex, 1);
            slots.splice(toIndex, 0, moved);
            return {
                ...group,
                slots: slots.map((slot, index) => ({ ...slot, position: index + 1 })),
            };
        });
        setOrders(next);
        setSnapshot(null);
    }

    // Toggles a single group in or out of the active filter.
    // If the result would be empty or all groups selected, reset to null (show all).
    function toggleGroupFocus(groupCode) {
        setFocusedGroups((current) => {
            if (!current) return new Set([groupCode]);
            const next = new Set(current);
            if (next.has(groupCode)) next.delete(groupCode);
            else next.add(groupCode);
            return next.size === 0 || next.size === orders.length ? null : next;
        });
    }

    function onDiscipline(value) {
        setDiscipline(value);
        setSnapshot(null);
    }

    // Updates a single score field (homeGoals or awayGoals) for a fixture.
    // Both the ref and the state are updated: the ref gives runSimulation() the latest
    // value immediately, while the state update triggers a re-render for the UI.
    function onScoreChange(fixture, field, rawValue) {
        const value = rawValue === "" ? "" : String(Math.max(0, Number(rawValue)));
        const current = manualScoresRef.current;
        const next = {
            ...current,
            [fixture.key]: {
                homeGoals: "",
                awayGoals: "",
                ...(current[fixture.key] ?? fixture),
                [field]: value,
            },
        };
        manualScoresRef.current = next;
        setManualScores(next);
        setSnapshot(null);
    }

    // Resets everything back to the initial state.
    // Incrementing scoreResetVersion changes the key on MatchScores, which forces
    // React to unmount and remount it — the simplest way to clear all its inputs.
    function handleReset() {
        const next = initialOrders(baseTeams ?? undefined);
        setOrders(next);
        manualScoresRef.current = {};
        setManualScores({});
        setScoreResetVersion((v) => v + 1);
        setSnapshot(null);
        setError(null);
    }

    return (
        <main className="min-h-screen">
            <header className="site-hero mx-auto flex max-w-[1400px] flex-col px-8">
                <div className="hero-video-layer" aria-hidden="true">
                    <video
                        className="hero-video"
                        autoPlay
                        muted
                        loop
                        playsInline
                        preload="metadata"
                        src="/world-cup-hero.webm"
                    />
                    <div className="hero-video-fallback" />
                </div>

                <motion.div
                    className="hero-lockup"
                    initial={{ opacity: 0, y: 28, scale: 0.985 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
                >
                    <p className="hero-eyebrow">2026 FIFA World Cup</p>
                    <h1 className="hero-title">Path to Glory</h1>
                    <p className="hero-copy">
                        Pick your favorite team, test every path, watch the probabilities move, and
                        chase the trophy.
                    </p>
                    <div className="hero-highlights" aria-label="Tracker highlights">
                        <span>Favorite team</span>
                        <span>Probability swings</span>
                        <span>Road to the trophy</span>
                    </div>
                </motion.div>

                <nav className="workflow-strip" aria-label="How the tracker works">
                    {[
                        [
                            "1",
                            "Shape the groups",
                            "Drag teams into your predicted order",
                            "Draw logic",
                        ],
                        [
                            "2",
                            "Add scores your way",
                            "Enter manual scores. Simulator fills the rest, Real Data can take over.",
                            "Simulator / Real Data",
                        ],
                        [
                            "3",
                            "Reveal the path",
                            "Calculate wildcards, bracket, Elo and form shifts",
                            "Elo + form",
                        ],
                    ].map(([step, title, body, badge], index) => {
                        const icons = [SlidersHorizontal, ClipboardList, Trophy];
                        const Icon = icons[index];
                        return (
                            <motion.div
                                key={step}
                                className="workflow-step"
                                initial={{ opacity: 0, y: 22 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, amount: 0.55 }}
                                transition={{
                                    duration: 0.58,
                                    delay: index * 0.12,
                                    ease: [0.2, 0.8, 0.2, 1],
                                }}
                            >
                                <div className="workflow-step-mark">
                                    <span className="workflow-step-number">{step}</span>
                                    <Icon className="workflow-step-icon" size={18} />
                                </div>
                                <div className="workflow-step-copy min-w-0">
                                    <div className="workflow-step-kicker">{body}</div>
                                    <div className="workflow-step-title">{title}</div>
                                </div>
                                <span className="workflow-step-badge">{badge}</span>
                            </motion.div>
                        );
                    })}
                </nav>

                <motion.section
                    className="group-stage-intro"
                    aria-labelledby="group-stage-heading"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.6 }}
                    transition={{ duration: 0.62, ease: [0.2, 0.8, 0.2, 1] }}
                >
                    <div className="section-masthead">
                        <span className="section-kicker">Group stage</span>
                        <h2 id="group-stage-heading">Shape the tournament before kickoff</h2>
                        <p>
                            Pick the groups you want to work on, drag teams into your predicted
                            order, enter any scores you know, then calculate the road ahead.
                        </p>
                    </div>
                    <AiScoreboard />
                </motion.section>

                <ControlDock
                    dataMode={dataMode}
                    onDataMode={setDataMode}
                    discipline={discipline}
                    onDiscipline={onDiscipline}
                    onCalculate={() => runSimulation()}
                    onReset={handleReset}
                    snapshot={snapshot}
                    onHelp={() => setShowTutorial(true)}
                />
            </header>

            {error ? (
                <div className="mx-auto mb-5 max-w-[1400px] px-8">
                    <div className="rounded-md border border-coral/40 bg-coral/10 px-4 py-3 text-sm text-coral">
                        {error}
                    </div>
                </div>
            ) : null}

            <section className="focus-section mx-auto max-w-[1400px] px-8" data-tutorial="focus">
                <div className="focus-bar">
                    <div className="focus-header">
                        <div className="focus-title-block">
                            <h2>Group Focus</h2>
                            <p>Select any mix of groups to narrow the board and score entry.</p>
                        </div>
                        <div className="focus-meta">
                            <span className="focus-count">
                                <Eye size={13} /> {visibleGroupCount}/12 visible
                            </span>
                            <button
                                className={`focus-show-all ${focusedGroups ? "is-filtered" : "is-all"}`}
                                onClick={() => setFocusedGroups(null)}
                            >
                                Show all
                            </button>
                        </div>
                    </div>
                    <div className="focus-chip-row">
                        {orders.map((order) => {
                            const active = !focusedGroups || focusedGroups.has(order.group);
                            return (
                                <button
                                    key={order.group}
                                    aria-label={`Toggle Group ${order.group}`}
                                    className={`focus-chip ${active ? "is-active" : ""}`}
                                    data-focus-group={order.group}
                                    onClick={() => toggleGroupFocus(order.group)}
                                    style={groupStyle(order.group)}
                                >
                                    <span className="focus-chip-dot" />
                                    <span>{order.group}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </section>

            <div className="mx-auto max-w-[1400px] px-8">
                <div className="momentum-legend">
                    <span className="momentum-legend-item is-positive">
                        <Zap size={12} /> Momentum gained — team performed better than expected
                    </span>
                    <span className="momentum-legend-item is-negative">
                        <Zap size={12} /> Momentum lost — team underperformed against expectations
                    </span>
                    <span className="momentum-legend-item is-neutral">
                        <Zap size={12} /> No momentum shift yet — hit Calculate to simulate
                    </span>
                </div>
            </div>

            <section
                className="groups-section mx-auto grid max-w-[1400px] gap-5 px-8 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
                data-tutorial="groups"
            >
                {visibleOrders.map((order) => (
                    <GroupBoard
                        key={order.group}
                        order={order}
                        result={resultsByGroup.get(order.group)}
                        onDropTeam={onDropTeam}
                        onIntelClick={setSelectedTeam}
                    />
                ))}
            </section>

            {/* key={scoreResetVersion} remounts MatchScores on reset, clearing all score inputs */}
            <MatchScores
                key={scoreResetVersion}
                orders={visibleOrders}
                allOrders={orders}
                scores={manualScores}
                onScoreChange={onScoreChange}
            />

            {snapshot?.wildcardTable?.length ? (
                <WildcardTable rows={snapshot.wildcardTable} />
            ) : null}

            {snapshot?.roundOf32?.length ? (
                // Flatten all group standings into team-keyed lookup objects
                // so the bracket can show each team's momentum and Elo at a glance.
                <RoundOf32
                    fixtures={snapshot.roundOf32}
                    mode={dataMode}
                    momentumByTeam={Object.fromEntries(
                        snapshot.groups
                            ?.flatMap((g) => g.standings ?? [])
                            .map((s) => [s.teamName, s.momentumShift]) ?? []
                    )}
                    eloByTeam={Object.fromEntries(
                        snapshot.groups
                            ?.flatMap((g) => g.standings ?? [])
                            .map((s) => [s.teamName, s.elo]) ?? []
                    )}
                />
            ) : null}

            {/* Fixed status badge — shows "Calculating" while the simulation is running,
                the snapshot time once it finishes, or "Ready" before first run. */}
            <div className="fixed bottom-4 right-4 rounded-md border border-line bg-panel/95 px-3 py-2 text-xs text-white/55 shadow-lg">
                {isPending
                    ? "Calculating momentum..."
                    : snapshot?.createdAt
                      ? `Snapshot ${new Date(snapshot.createdAt).toLocaleTimeString()}`
                      : "Ready"}
            </div>

            <Footer />
            <Tutorial forceOpen={showTutorial} onClose={() => setShowTutorial(false)} />
            <TeamIntelDrawer team={selectedTeam} onClose={() => setSelectedTeam(null)} />
        </main>
    );
}
