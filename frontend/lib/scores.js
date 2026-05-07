// Utilities for building the manual-score payload sent to the simulator.
// There are two ways to collect scores — from React state or directly from the DOM.
// See manualScorePayloadFromInputs for why both approaches exist.

// Builds the payload from the scores object stored in React state (manualScoresRef).
// Only includes fixtures where both goals have been filled in — partial entries are skipped.
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

// Builds the payload by reading score input values directly from the DOM.
// This is used as the primary source when Calculate is clicked because the score
// inputs are uncontrolled — their live values in the DOM, not in React state.
// Falls back to null on the server (no document) so the caller can use manualScorePayload instead.
export function manualScorePayloadFromInputs() {
    if (typeof document === "undefined") return null;
    const pairs = new Map();

    // Each score input has data attributes identifying its group, teams, and side (home/away).
    // We pair home and away inputs together using the fixture key before building the payload.
    document.querySelectorAll("[data-score-input='true']").forEach((input) => {
        const { group, homeId, awayId, scoreSide } = input.dataset;
        if (!group || !homeId || !awayId || !scoreSide) return;
        const key = `${group}:${homeId}:${awayId}`;
        const current = pairs.get(key) ?? { group, homeId, awayId, homeGoals: "", awayGoals: "" };
        current[scoreSide === "home" ? "homeGoals" : "awayGoals"] = input.value;
        pairs.set(key, current);
    });

    // Same filter as manualScorePayload — only send fixtures where both sides are filled in.
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
