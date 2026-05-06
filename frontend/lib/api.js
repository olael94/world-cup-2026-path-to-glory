const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export async function fetchTeams() {
    const response = await fetch(`${API_BASE}/teams`);
    if (!response.ok) {
        throw new Error(`Teams failed: ${response.status}`);
    }
    return response.json();
}

export async function simulate(
    groups,
    discipline,
    manualScores = [],
    snapshotName = "My Bold Prediction"
) {
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
