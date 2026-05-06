"use client";

import { Calculator } from "lucide-react";
import { CountryLabel } from "./CountryLabel";
import { groupMatchSchedule, groupStyle } from "../lib/seedData";

export function MatchScores({ orders, allOrders = orders, scores, onScoreChange }) {
    const filled = Object.values(scores).filter(
        (score) => score.homeGoals !== "" && score.awayGoals !== ""
    ).length;
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
            defaultValue={value}
            onInput={(event) => onChange(event.currentTarget.value)}
            placeholder="--"
        />
    );
}

function groupFixtures(order) {
    const teams = order.slots.map((slot) => slot.team);
    const teamById = new Map(teams.map((team) => [team.id, team]));
    const scheduled = groupMatchSchedule[order.group] ?? [];
    if (scheduled.length > 0) {
        return scheduled
            .map(([homeId, awayId]) => {
                const home = teamById.get(homeId);
                const away = teamById.get(awayId);
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
    return teams.flatMap((home, homeIndex) =>
        teams.slice(homeIndex + 1).map((away) => ({
            group: order.group,
            home,
            away,
            key: scoreKey(order.group, home.id, away.id),
        }))
    );
}

export function scoreKey(group, homeId, awayId) {
    return `${group}:${homeId}:${awayId}`;
}
