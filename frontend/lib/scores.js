// Utilities for building the manual-score payload sent to the simulator.

export function manualScorePayload(scores) {
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

export function manualScorePayloadFromInputs() {
    if (typeof document === "undefined") return null;
    const pairs = new Map();

    document.querySelectorAll("[data-score-input='true']").forEach((input) => {
        const { group, homeId, awayId, scoreSide } = input.dataset;
        if (!group || !homeId || !awayId || !scoreSide) return;
        const key = `${group}:${homeId}:${awayId}`;
        const current = pairs.get(key) ?? { group, homeId, awayId, homeGoals: "", awayGoals: "" };
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
