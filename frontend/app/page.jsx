"use client";

import {useEffect, useMemo, useRef, useState, useTransition} from "react";
import {motion} from "framer-motion";
import {
    Activity,
    CheckCircle2,
    ClipboardList,
    Eye,
    Info,
    RotateCcw,
    Save,
    SlidersHorizontal,
    Sparkles,
    Trophy,
    Zap
} from "lucide-react";
import {GroupBoard} from "../components/GroupBoard";
import {RoundOf32, WildcardTable} from "../components/Leaderboards";
import {MatchScores} from "../components/MatchScores";
import {fetchTeams, simulate} from "../lib/api";
import {groupStyle, initialOrders, mergeTeamIntelligence} from "../lib/seedData";
import {Tutorial} from "../components/Tutorial";
import {Footer} from "../components/Footer";
import {TeamIntelDrawer} from "../components/TeamIntelDrawer";

export default function Home() {
    const [orders, setOrders] = useState(() => initialOrders());
    const [baseTeams, setBaseTeams] = useState(null);
    const [discipline, setDiscipline] = useState(50);
    const [dataMode, setDataMode] = useState("simulation");
    const [focusedGroups, setFocusedGroups] = useState(null);
    const [manualScores, setManualScores] = useState({});
    const [scoreResetVersion, setScoreResetVersion] = useState(0);
    const manualScoresRef = useRef({});
    const [snapshot, setSnapshot] = useState(null);
    const [showTutorial, setShowTutorial] = useState(false);
    const [error, setError] = useState(null);
    const [isPending, startTransition] = useTransition();
    const [selectedTeam, setSelectedTeam] = useState(null);

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

    const resultsByGroup = useMemo(
        () => new Map(snapshot?.groups.map((group) => [group.group, group]) ?? []),
        [snapshot]
    );
    const visibleOrders = useMemo(
        () => (focusedGroups ? orders.filter((order) => focusedGroups.has(order.group)) : orders),
        [focusedGroups, orders]
    );
    const visibleGroupCount = focusedGroups?.size ?? orders.length;

    function runSimulation(nextOrders = orders, nextDiscipline = discipline, nextManualScores = manualScorePayloadFromInputs() ?? manualScorePayload(manualScoresRef.current)) {
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

    function onDropTeam(groupCode, fromIndex, toIndex) {
        const next = orders.map((group) => {
            if (group.group !== groupCode) return group;
            const slots = [...group.slots];
            const [moved] = slots.splice(fromIndex, 1);
            slots.splice(toIndex, 0, moved);
            return {...group, slots: slots.map((slot, index) => ({...slot, position: index + 1}))};
        });
        setOrders(next);
        setSnapshot(null);
    }

    function toggleGroupFocus(groupCode) {
        setFocusedGroups((current) => {
            if (!current) return new Set([groupCode]);
            const next = new Set(current);
            if (next.has(groupCode)) {
                next.delete(groupCode);
            } else {
                next.add(groupCode);
            }
            return next.size === 0 || next.size === orders.length ? null : next;
        });
    }

    function onDiscipline(value) {
        setDiscipline(value);
        setSnapshot(null);
    }

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
                    <div className="hero-video-fallback"/>
                </div>
                <motion.div
                    className="hero-lockup"
                    initial={{opacity: 0, y: 28, scale: 0.985}}
                    animate={{opacity: 1, y: 0, scale: 1}}
                    transition={{duration: 0.8, ease: [0.2, 0.8, 0.2, 1]}}
                >
                    <p className="hero-eyebrow">2026 FIFA World Cup</p>
                    <h1 className="hero-title">Path to Glory</h1>
                    <p className="hero-copy">
                        Pick your favorite team, test every path, watch the probabilities move, and chase the trophy.
                    </p>
                    <div className="hero-highlights" aria-label="Tracker highlights">
                        <span>Favorite team</span>
                        <span>Probability swings</span>
                        <span>Road to the trophy</span>
                    </div>
                </motion.div>

                <nav className="workflow-strip" aria-label="How the tracker works">
                    {[
                        ["1", "Shape the groups", "Drag teams into your predicted order", "Draw logic"],
                        ["2", "Add scores your way", "Enter manual scores. Simulator fills the rest, Real Data can take over.", "Simulator / Real Data"],
                        ["3", "Reveal the path", "Calculate wildcards, bracket, Elo and form shifts", "Elo + form"],
                    ].map(([step, title, body, badge], index) => {
                        const icons = [SlidersHorizontal, ClipboardList, Trophy];
                        const Icon = icons[index];
                        return (
                            <motion.div
                                key={step}
                                className="workflow-step"
                                initial={{opacity: 0, y: 22}}
                                whileInView={{opacity: 1, y: 0}}
                                viewport={{once: true, amount: 0.55}}
                                transition={{duration: 0.58, delay: index * 0.12, ease: [0.2, 0.8, 0.2, 1]}}
                            >
                                <div className="workflow-step-mark">
                                    <span className="workflow-step-number">{step}</span>
                                    <Icon className="workflow-step-icon" size={18}/>
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
                    initial={{opacity: 0, y: 20}}
                    whileInView={{opacity: 1, y: 0}}
                    viewport={{once: true, amount: 0.6}}
                    transition={{duration: 0.62, ease: [0.2, 0.8, 0.2, 1]}}
                >
                    <div className="section-masthead">
                        <span className="section-kicker">Group stage</span>
                        <h2 id="group-stage-heading">Shape the tournament before kickoff</h2>
                        <p>Pick the groups you want to work on, drag teams into your predicted order, enter any scores you know, then calculate the road ahead.</p>
                    </div>
                    <AiScoreboard />
                    <div className="momentum-legend">
                        <span className="momentum-legend-item is-positive"><Zap size={12}/> Momentum gained — team performed better than expected</span>
                        <span className="momentum-legend-item is-negative"><Zap size={12}/> Momentum lost — team underperformed against expectations</span>
                        <span className="momentum-legend-item is-neutral"><Zap size={12}/> No momentum shift yet — hit Calculate to simulate</span>
                    </div>
                </motion.section>

                <div className="control-dock">
                    <div className="control-dock-rail">
                        <div className="control-mode-group">
                            <div className="control-mode-switch" aria-label="Data mode" data-tutorial="mode">
                                {[
                                    ["simulation", "Simulator"],
                                    ["real", "Real Data"],
                                ].map(([mode, label]) => (
                                    <button
                                        key={mode}
                                        className={`control-mode-button ${dataMode === mode ? "is-active" : ""}`}
                                        onClick={() => setDataMode(mode)}
                                    >
                                        {dataMode === mode ? (
                                            <motion.span
                                                className="control-mode-active"
                                                layoutId="control-mode-active"
                                                transition={{type: "spring", stiffness: 420, damping: 34}}
                                            />
                                        ) : null}
                                        <span className="control-mode-label">{label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="control-discipline-group" data-tutorial="discipline">
                            <div className="control-discipline-heading">
                                <span className="control-label">Discipline</span>
                                <span className="control-value">{discipline}</span>
                            </div>
                            <label className="control-slider-wrap">
                                <input
                                    aria-label="Discipline slider"
                                    className="control-slider accent-mint"
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={discipline}
                                    onChange={(event) => onDiscipline(Number(event.target.value))}
                                />
                            </label>
                        </div>

                        <div className="control-actions" aria-label="Scenario actions">
                            <button
                                className="control-action-primary"
                                data-tutorial="calculate"
                                onClick={() => runSimulation()}
                            >
                                <Activity size={17}/> Calculate
                            </button>
                            <button
                                className="control-action-secondary"
                                data-tutorial="reset"
                                onClick={() => {
                                    const next = initialOrders(baseTeams ?? undefined);
                                    setOrders(next);
                                    manualScoresRef.current = {};
                                    setManualScores({});
                                    setScoreResetVersion((version) => version + 1);
                                    setSnapshot(null);
                                    setError(null);
                                }}
                            >
                                <RotateCcw size={16}/> Reset
                            </button>
                            <div className="control-status" data-tutorial="draft">
                                {snapshot?.snapshotId ? <CheckCircle2 size={16}/> : <Save size={16}/>}
                                {snapshot?.snapshotId ? "Saved" : "Draft"}
                            </div>
                        </div>

                        <button className="control-help-btn" onClick={() => setShowTutorial(true)}>
                            <Info size={15}/>
                            Guide
                        </button>
                    </div>
                </div>
            </header>

            {error ? (
                <div className="mx-auto mb-5 max-w-[1400px] px-8">
                    <div
                        className="rounded-md border border-coral/40 bg-coral/10 px-4 py-3 text-sm text-coral">{error}</div>
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
                <Eye size={13}/> {visibleGroupCount}/12 visible
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
                                    <span className="focus-chip-dot"/>
                                    <span>{order.group}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </section>

            <section
                className="groups-section mx-auto grid max-w-[1400px] gap-5 px-8 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
                data-tutorial="groups">
                {visibleOrders.map((order) => (
                    <GroupBoard key={order.group} order={order} result={resultsByGroup.get(order.group)}
                                onDropTeam={onDropTeam} onIntelClick={setSelectedTeam}/>
                ))}
            </section>

            <MatchScores key={scoreResetVersion} orders={visibleOrders} allOrders={orders} scores={manualScores}
                         onScoreChange={onScoreChange}/>

            {snapshot?.wildcardTable?.length ? <WildcardTable rows={snapshot.wildcardTable}/> : null}
            {snapshot?.roundOf32?.length ? (
                <RoundOf32
                    fixtures={snapshot.roundOf32}
                    mode={dataMode}
                    momentumByTeam={Object.fromEntries(
                        snapshot.groups?.flatMap(g => g.standings ?? []).map(s => [s.teamName, s.momentumShift]) ?? []
                    )}
                    eloByTeam={Object.fromEntries(
                        snapshot.groups?.flatMap(g => g.standings ?? []).map(s => [s.teamName, s.elo]) ?? []
                    )}
                />
            ) : null}

            <div
                className="fixed bottom-4 right-4 rounded-md border border-line bg-panel/95 px-3 py-2 text-xs text-white/55 shadow-lg">
                {isPending ? "Calculating momentum..." : snapshot?.createdAt ? `Snapshot ${new Date(snapshot.createdAt).toLocaleTimeString()}` : "Ready"}
            </div>
            <Footer />
            <Tutorial forceOpen={showTutorial} onClose={() => setShowTutorial(false)}/>
            <TeamIntelDrawer team={selectedTeam} onClose={() => setSelectedTeam(null)}/>
        </main>
    );
}

function AiScoreboard() {
    const messages = [
        {
            icon: "✦",
            text: "Let AI guide your predictions.",
            bg: "rgba(113, 229, 183, 0.10)",
            border: "rgba(113, 229, 183, 0.28)",
            glow: "rgba(113, 229, 183, 0.8)",
            color: "#71e5b7",
        },
        {
            icon: "📡",
            text: "Live news, real injuries, and how every team is performing right now.",
            bg: "rgba(76, 132, 255, 0.10)",
            border: "rgba(76, 132, 255, 0.28)",
            glow: "rgba(76, 132, 255, 0.8)",
            color: "#7eb4ff",
        },
        {
            icon: "🏆",
            text: "Analyzed so you know who's truly on a path to glory.",
            bg: "rgba(255, 177, 64, 0.10)",
            border: "rgba(255, 177, 64, 0.28)",
            glow: "rgba(255, 177, 64, 0.8)",
            color: "#ffcf7b",
        },
    ];
    const SLIDE_H = "3.2rem";
    const [index, setIndex] = useState(0);
    const [sliding, setSliding] = useState(false);
    const nextIndex = (index + 1) % messages.length;

    useEffect(() => {
        const interval = setInterval(() => {
            setSliding(true);
            setTimeout(() => {
                setIndex((prev) => (prev + 1) % messages.length);
                setSliding(false);
            }, 650);
        }, 8000);
        return () => clearInterval(interval);
    }, []);

    const current = messages[index];
    const next = messages[nextIndex];

    return (
        <div className="ai-scoreboard-wrap" aria-live="polite">
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    width: "100%",
                    transform: sliding ? `translateY(-${SLIDE_H})` : "translateY(0)",
                    transition: sliding ? "transform 0.65s cubic-bezier(0.4, 0, 0.2, 1)" : "none",
                }}
            >
                <div className="ai-scoreboard-slide" style={{ height: SLIDE_H, background: current.bg }}>
                    <span className="ai-scoreboard-icon">{current.icon}</span>
                    <span className="ai-scoreboard-text" style={{ color: current.color }}>
                        {current.text}
                    </span>
                </div>
                <div className="ai-scoreboard-slide" style={{ height: SLIDE_H, background: next.bg }}>
                    <span className="ai-scoreboard-icon">{next.icon}</span>
                    <span className="ai-scoreboard-text" style={{ color: next.color }}>
                        {next.text}
                    </span>
                </div>
            </div>
        </div>
    );
}

function manualScorePayload(scores) {
    return Object.values(scores)
        .filter((score) => score.homeGoals !== "" && score.awayGoals !== "")
        .map((score) => ({
            group: score.group,
            homeId: score.home.id,
            awayId: score.away.id,
            homeGoals: Number(score.homeGoals),
            awayGoals: Number(score.awayGoals),
        }));
}

function manualScorePayloadFromInputs() {
    if (typeof document === "undefined") return null;
    const pairs = new Map();
    document.querySelectorAll("[data-score-input='true']").forEach((input) => {
        const {group, homeId, awayId, scoreSide} = input.dataset;
        if (!group || !homeId || !awayId || !scoreSide) return;
        const key = `${group}:${homeId}:${awayId}`;
        const current = pairs.get(key) ?? {group, homeId, awayId, homeGoals: "", awayGoals: ""};
        current[scoreSide === "home" ? "homeGoals" : "awayGoals"] = input.value;
        pairs.set(key, current);
    });

    return [...pairs.values()]
        .filter((score) => score.homeGoals !== "" && score.awayGoals !== "")
        .map((score) => ({
            group: score.group,
            homeId: score.homeId,
            awayId: score.awayId,
            homeGoals: Number(score.homeGoals),
            awayGoals: Number(score.awayGoals),
        }));
}
