// NEXT_PUBLIC_ prefix is required for Next.js to expose this env var to the browser.
// Falls back to localhost for local development.
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

// Fetches all teams from the backend, including any AI-adjusted Elo and form values.
export async function fetchTeams() {
    const response = await fetch(`${API_BASE}/teams`);
    if (!response.ok) {
        throw new Error(`Teams failed: ${response.status}`);
    }
    return response.json();
}

// Sends the current group order, discipline setting, and any manual scores
// to the backend to run a full simulation. Returns the saved snapshot.
export async function simulate(
    groups,
    discipline,
    manualScores = [],
    snapshotName = "My Bold Prediction"
) {
    // Strip each team down to only the fields the backend expects.
    // The full team objects in state include extra frontend-only fields (flags,
    // intel data, etc.) that would bloat the request and might fail validation.
    const payloadGroups = groups.map((group) => ({
        ...group,
        slots: group.slots.map((slot) => ({
            position: slot.position,
            team: {
                id: slot.team.id,
                name: slot.team.name,
                group: slot.team.group,
                ranking: slot.team.ranking,
                drawOrder: slot.team.drawOrder,
                elo: slot.team.elo,
                form: slot.team.form,
                historicalMatches: slot.team.historicalMatches,
            },
        })),
    }));
    const payload = { snapshotName, discipline, groups: payloadGroups, manualScores };

    const response = await fetch(`${API_BASE}/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error(`Simulation failed: ${response.status}`);
    }

    return response.json();
}
