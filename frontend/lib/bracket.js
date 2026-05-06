// Pure bracket-logic utilities — no React, fully testable in isolation.

export function buildBracketRounds(roundOf32, picks) {
    const r32 = applyPicks(roundOf32, picks);
    const roundOf16 = pairWinners("R16", r32, 8, picks, [
        "Philadelphia Stadium",
        "New York New Jersey Stadium",
        "Dallas Stadium",
        "Atlanta Stadium",
        "Seattle Stadium",
        "Vancouver Stadium",
        "Miami Stadium",
        "Kansas City Stadium",
    ]);
    const quarterfinals = pairWinners("QF", roundOf16, 4, picks, [
        "Boston Stadium",
        "Los Angeles Stadium",
        "Miami Stadium",
        "Kansas City Stadium",
    ]);
    const semifinals = pairWinners("SF", quarterfinals, 2, picks, [
        "Dallas Stadium",
        "Atlanta Stadium",
    ]);

    return [
        { name: "Round of 32", fixtures: r32 },
        { name: "Round of 16", fixtures: roundOf16 },
        { name: "Quarterfinals", fixtures: quarterfinals },
        { name: "Semifinals", fixtures: semifinals },
        {
            name: "Final",
            fixtures: applyPicks(
                [
                    {
                        displayId: "Final",
                        venue: "New York New Jersey Stadium",
                        sourceIds: ["SF-1", "SF-2"],
                        home: winnerOrPlaceholder(semifinals[0]),
                        away: winnerOrPlaceholder(semifinals[1]),
                    },
                ],
                picks
            ),
        },
    ];
}

export function pairWinners(prefix, previousFixtures, count, picks, venues) {
    return applyPicks(
        Array.from({ length: count }, (_, index) => {
            const first = previousFixtures[index * 2];
            const second = previousFixtures[index * 2 + 1];
            return {
                displayId: `${prefix}-${index + 1}`,
                venue: venues[index],
                sourceIds: [first?.displayId, second?.displayId].filter(Boolean),
                home: winnerOrPlaceholder(first),
                away: winnerOrPlaceholder(second),
            };
        }),
        picks
    );
}

export function applyPicks(fixtures, picks) {
    return fixtures.map((fixture) => {
        const winner = canPickTeam(fixture, picks[fixture.displayId])
            ? picks[fixture.displayId]
            : fixture.winner;
        return { ...fixture, winner };
    });
}

export function winnerOrPlaceholder(fixture) {
    return fixture?.winner ?? `Winner ${fixture?.displayId ?? "TBD"}`;
}

export function canPickTeam(fixture, teamName) {
    return teamName === fixture.home || teamName === fixture.away;
}

export function isConcreteTeam(name) {
    return Boolean(name) && !name.startsWith("Winner ") && !name.startsWith("Pending");
}

export function isLockedFixture(fixture, mode) {
    return mode === "real" && fixture.locked === true;
}

export function readDragPayload(event) {
    try {
        const raw = event.dataTransfer.getData("application/json");
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export function descendantFixtureIds(rounds, fixtureId) {
    const descendants = new Set();
    let frontier = new Set([fixtureId]);

    rounds.forEach((round) => {
        const nextFrontier = new Set();
        round.fixtures.forEach((fixture) => {
            if (fixture.sourceIds?.some((sourceId) => frontier.has(sourceId))) {
                descendants.add(fixture.displayId);
                nextFrontier.add(fixture.displayId);
            }
        });
        if (nextFrontier.size) frontier = nextFrontier;
    });

    return descendants;
}

export function connectorPath(x1, y1, x2, y2) {
    const gap = Math.max(24, x2 - x1);
    const midX = x1 + gap / 2;
    const direction = y2 >= y1 ? 1 : -1;
    const radius = Math.min(18, Math.abs(y2 - y1) / 2, gap / 4);

    if (Math.abs(y2 - y1) < 1) {
        return `M ${x1} ${y1} H ${x2}`;
    }

    return [
        `M ${x1} ${y1}`,
        `H ${midX - radius}`,
        `Q ${midX} ${y1} ${midX} ${y1 + direction * radius}`,
        `V ${y2 - direction * radius}`,
        `Q ${midX} ${y2} ${midX + radius} ${y2}`,
        `H ${x2}`,
    ].join(" ");
}
