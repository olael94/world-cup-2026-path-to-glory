"use client";

import { Calculator } from "lucide-react";
import { CountryLabel } from "./CountryLabel";
import { groupMatchSchedule, groupStyle } from "../lib/seedData";

// Shows score input fields for every match in the currently visible groups.
// orders = only the groups the user has filtered to (what's shown on screen).
// allOrders = all 12 groups, used to calculate the true total count in the stat pill.
export function MatchScores({ orders, allOrders = orders, scores, onScoreChange }) {
    // Count how many fixtures have both goals filled in (neither is an empty string).
    const filled = Object.values(scores).filter(
        (score) => score.homeGoals !== "" && score.awayGoals !== ""
    ).length;
    // Each group has exactly 6 round-robin matches (4 teams, every pair plays once).
    const total = allOrders.length * 6;
    const visibleTotal = orders.length * 6;

    return (
        <section className="match-scores-section mx-auto max-w-[1400px] px-8">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <div className="section-masthead">
                    <span className="section-kicker">Manual entry</span>
                    <h2>Match Scores</h2>
                    <p>
                        Only focused groups appear here. Add known scores and let the simulator fill
                        the blanks.
                    </p>
                </div>
                <div className="section-stat-pill">
                    <Calculator size={16} /> {filled}/{total} entered · {visibleTotal} visible
                </div>
            </div>
            <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                {orders.map((order) => (
                    <section
                        key={order.group}
                        className="group-panel rounded-lg border border-line bg-panel/80 p-3"
                        style={groupStyle(order.group)}
                    >
                        <h3 className="mb-3 text-sm font-bold uppercase text-white/55">
                            <span className="group-chip">Group {order.group}</span>
                        </h3>
                        <div className="grid gap-2">
                            {groupFixtures(order).map((fixture) => {
                                // Merge saved score values over the empty defaults, so inputs
                                // always have a controlled starting value even if untouched.
                                const score = {
                                    homeGoals: "",
                                    awayGoals: "",
                                    ...(scores[fixture.key] ?? {}),
                                };
                                return (
                                    <div
                                        key={fixture.key}
                                        className="match-fixture-row grid grid-cols-[minmax(0,1fr)_2.35rem_auto_2.35rem_minmax(0,1fr)] items-center gap-1 rounded-md border px-2 py-2 text-xs sm:grid-cols-[minmax(0,1fr)_3.25rem_auto_3.25rem_minmax(0,1fr)] sm:gap-2 sm:text-sm"
                                    >
                                        <div className="min-w-0 font-semibold">
                                            <CountryLabel
                                                name={fixture.home.name}
                                                className="max-w-full"
                                            />
                                        </div>
                                        <ScoreInput
                                            fixture={fixture}
                                            side="home"
                                            testId={`score-${fixture.key}-home`}
                                            value={score.homeGoals}
                                            onChange={(value) =>
                                                onScoreChange(fixture, "homeGoals", value)
                                            }
                                        />
                                        <span className="text-center text-white/35">-</span>
                                        <ScoreInput
                                            fixture={fixture}
                                            side="away"
                                            testId={`score-${fixture.key}-away`}
                                            value={score.awayGoals}
                                            onChange={(value) =>
                                                onScoreChange(fixture, "awayGoals", value)
                                            }
                                        />
                                        <div className="min-w-0 text-right font-semibold">
                                            <CountryLabel
                                                name={fixture.away.name}
                                                className="max-w-full justify-end"
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                ))}
            </div>
        </section>
    );
}

// A single goal count input for one side of a match.
// The data-* attributes are read by manualScorePayloadFromInputs() in scores.js
// to collect all entered scores directly from the DOM without going through React state.
function ScoreInput({ fixture, side, testId, value, onChange }) {
    return (
        <input
            aria-label="Goals"
            className="match-score-input h-8 w-full rounded border text-center text-xs font-bold text-white outline-none sm:h-9 sm:text-sm"
            data-away-id={fixture.away.id}
            data-group={fixture.group}
            data-home-id={fixture.home.id}
            data-score-side={side}
            data-score-input="true"
            data-testid={testId}
            inputMode="numeric"
            min="0"
            type="number"
            // defaultValue (not value) makes this an uncontrolled input — the DOM owns
            // the value between keystrokes, and onInput fires on every change.
            defaultValue={value}
            onInput={(event) => onChange(event.currentTarget.value)}
            placeholder="--"
        />
    );
}

// Builds the list of fixtures to show for a group.
// If the group has a fixed match schedule in seedData, use that order (reflects the
// real FIFA schedule). Otherwise, fall back to generating all round-robin pairs.
function groupFixtures(order) {
    const teams = order.slots.map((slot) => slot.team);
    const teamById = new Map(teams.map((team) => [team.id, team]));
    const scheduled = groupMatchSchedule[order.group] ?? [];
    if (scheduled.length > 0) {
        return scheduled
            .map(([homeId, awayId]) => {
                const home = teamById.get(homeId);
                const away = teamById.get(awayId);
                // Skip this fixture if either team isn't found (e.g., the group order changed).
                if (!home || !away) return null;
                return {
                    group: order.group,
                    home,
                    away,
                    key: scoreKey(order.group, home.id, away.id),
                };
            })
            .filter(Boolean);
    }
    // Generate all unique pairs (each team plays every other team exactly once).
    return teams.flatMap((home, homeIndex) =>
        teams.slice(homeIndex + 1).map((away) => ({
            group: order.group,
            home,
            away,
            key: scoreKey(order.group, home.id, away.id),
        }))
    );
}

// Produces a unique string key for a fixture used to store and look up its score.
// Format: "group:homeId:awayId" — e.g. "A:mex:rsa"
export function scoreKey(group, homeId, awayId) {
    return `${group}:${homeId}:${awayId}`;
}
