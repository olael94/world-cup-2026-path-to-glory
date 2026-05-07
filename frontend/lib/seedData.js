import historicalRatings from "./generated/historicalRatings.json";

// ── Team seed data ────────────────────────────────────────────────────────────
// Each row: [id, name, group, FIFA ranking, draw position, flag emoji, optional flag image path]
// Draw position (1–4) is the order teams were drawn into the group at the FIFA draw ceremony.
// Elo and form come from historicalRatings.json — the emoji flag is the fallback if no image exists.
export const seededTeams = [
    ["mex", "Mexico", "A", 15, 1, "🇲🇽"],
    ["rsa", "South Africa", "A", 59, 2, "🇿🇦"],
    ["kor", "Korea Republic", "A", 22, 3, "🇰🇷"],
    ["cze", "Czechia", "A", 44, 4, "🇨🇿"],
    ["can", "Canada", "B", 31, 1, "🇨🇦"],
    ["bih", "Bosnia-Herzegovina", "B", 63, 2, "🇧🇦"],
    ["qat", "Qatar", "B", 34, 3, "🇶🇦"],
    ["sui", "Switzerland", "B", 19, 4, "🇨🇭"],
    ["bra", "Brazil", "C", 5, 1, "🇧🇷"],
    ["mar", "Morocco", "C", 14, 2, "🇲🇦"],
    ["hai", "Haiti", "C", 83, 3, "🇭🇹"],
    ["sco", "Scotland", "C", 38, 4, "🏴", "/flags/scotland.svg"],
    ["usa", "USA", "D", 13, 1, "🇺🇸"],
    ["par", "Paraguay", "D", 48, 2, "🇵🇾"],
    ["aus", "Australia", "D", 26, 3, "🇦🇺"],
    ["tur", "Türkiye", "D", 27, 4, "🇹🇷"],
    ["ger", "Germany", "E", 9, 1, "🇩🇪"],
    ["cur", "Curaçao", "E", 90, 2, "🇨🇼"],
    ["civ", "Côte d'Ivoire", "E", 46, 3, "🇨🇮"],
    ["ecu", "Ecuador", "E", 24, 4, "🇪🇨"],
    ["ned", "Netherlands", "F", 7, 1, "🇳🇱"],
    ["jpn", "Japan", "F", 18, 2, "🇯🇵"],
    ["swe", "Sweden", "F", 29, 3, "🇸🇪"],
    ["tun", "Tunisia", "F", 41, 4, "🇹🇳"],
    ["bel", "Belgium", "G", 8, 1, "🇧🇪"],
    ["egy", "Egypt", "G", 32, 2, "🇪🇬"],
    ["irn", "IR Iran", "G", 20, 3, "🇮🇷"],
    ["nzl", "New Zealand", "G", 86, 4, "🇳🇿"],
    ["esp", "Spain", "H", 3, 1, "🇪🇸"],
    ["cpv", "Cabo Verde", "H", 65, 2, "🇨🇻"],
    ["ksa", "Saudi Arabia", "H", 57, 3, "🇸🇦"],
    ["uru", "Uruguay", "H", 11, 4, "🇺🇾"],
    ["fra", "France", "I", 2, 1, "🇫🇷"],
    ["sen", "Senegal", "I", 17, 2, "🇸🇳"],
    ["irq", "Iraq", "I", 56, 3, "🇮🇶"],
    ["nor", "Norway", "I", 28, 4, "🇳🇴"],
    ["arg", "Argentina", "J", 1, 1, "🇦🇷"],
    ["alg", "Algeria", "J", 37, 2, "🇩🇿"],
    ["aut", "Austria", "J", 25, 3, "🇦🇹"],
    ["jor", "Jordan", "J", 62, 4, "🇯🇴"],
    ["por", "Portugal", "K", 6, 1, "🇵🇹"],
    ["cod", "Congo DR", "K", 60, 2, "🇨🇩"],
    ["uzb", "Uzbekistan", "K", 58, 3, "🇺🇿"],
    ["col", "Colombia", "K", 12, 4, "🇨🇴"],
    ["eng", "England", "L", 4, 1, "🏴", "/flags/england.svg"],
    ["cro", "Croatia", "L", 10, 2, "🇭🇷"],
    ["gha", "Ghana", "L", 60, 3, "🇬🇭"],
    ["pan", "Panama", "L", 43, 4, "🇵🇦"],
].map(([id, name, group, ranking, drawOrder, flag, flagImage]) => ({
    id: String(id),
    name: String(name),
    group: String(group),
    ranking: Number(ranking),
    drawOrder: Number(drawOrder),
    flag,
    flagImage,
    // Pull Elo and form from the generated ratings file. Fall back to a formula-based
    // estimate if a team isn't in the file yet, and 50 form if form data is missing.
    elo: historicalRatings.teams[id]?.elo ?? fallbackElo(Number(ranking)),
    form: historicalRatings.teams[id]?.form ?? 50,
    historicalMatches: historicalRatings.teams[id]?.historicalMatches ?? 0,
}));

// ── Lookup tables ─────────────────────────────────────────────────────────────
// Pre-built for fast access — avoids searching the array on every render.
export const flagByTeamId = Object.fromEntries(seededTeams.map((team) => [team.id, team.flag]));
export const flagImageByTeamId = Object.fromEntries(
    seededTeams.map((team) => [team.id, team.flagImage])
);
// Keyed by name because the bracket uses team names as identifiers, not IDs.
export const teamByName = Object.fromEntries(seededTeams.map((team) => [team.name, team]));

// Estimates an Elo rating from a FIFA ranking when no historical data exists.
// Top-ranked teams (rank 1) get ~1856, teams ranked 90+ stay at the base of 1500.
function fallbackElo(ranking) {
    return 1500 + Math.max(0, 90 - ranking) * 4;
}

// ── Group color themes ────────────────────────────────────────────────────────
// Each group has a unique color inspired by its host city.
// Both hex (for CSS color values) and rgb (for rgba() with opacity) are stored
// because CSS can't convert between the two at runtime without a custom property trick.
export const groupThemes = {
    A: { color: "#34D26F", rgb: "52, 210, 111", name: "Atlanta green" },
    B: { color: "#FFA840", rgb: "255, 168, 64", name: "Boston orange" },
    C: { color: "#B0E800", rgb: "176, 232, 0", name: "Dallas lime" },
    D: { color: "#20E8B8", rgb: "32, 232, 184", name: "Guadalajara teal" },
    E: { color: "#3D6DFF", rgb: "61, 109, 255", name: "Houston blue" },
    F: { color: "#FF315D", rgb: "255, 49, 93", name: "Kansas City pink" },
    G: { color: "#F0FF80", rgb: "240, 255, 128", name: "Los Angeles light" },
    H: { color: "#8A5CFF", rgb: "138, 92, 255", name: "Mexico City purple" },
    I: { color: "#80E0F0", rgb: "128, 224, 240", name: "Miami cyan" },
    J: { color: "#B6A213", rgb: "182, 162, 19", name: "Seattle gold" },
    K: { color: "#00C0A8", rgb: "0, 192, 168", name: "New York New Jersey teal" },
    L: { color: "#80B0FF", rgb: "128, 176, 255", name: "Philadelphia blue" },
};

// Returns the theme for a group, falling back to mint if the group isn't found.
export function groupTheme(group) {
    return groupThemes[group] ?? { color: "#71e5b7", rgb: "113, 229, 183", name: "Default" };
}

// Returns a React style object with the three CSS variables used throughout the UI
// to color team cards, borders, glows, and badges for a given group.
export function groupStyle(group) {
    const theme = groupTheme(group);
    return {
        "--group-color": theme.color,
        "--group-rgb": theme.rgb,
        // --group-ink is the text color to use on top of the group color (black or white),
        // calculated to ensure enough contrast for readability.
        "--group-ink": readableInk(theme.rgb),
    };
}

// Calculates whether black or white text is more readable on top of a given background color.
// Uses the W3C relative luminance formula — the same standard used in accessibility tools.
// Returns dark text for light backgrounds, white text for dark backgrounds.
function readableInk(rgb) {
    const [red, green, blue] = rgb.split(",").map((part) => Number(part.trim()) / 255);
    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    return luminance > 0.48 ? "#020504" : "#ffffff";
}

// Merges AI-adjusted team data from the backend over the local seed data.
// Seed data is the base — backend fields (adjusted Elo, form, news etc.) overwrite
// matching fields. Any team the backend doesn't return keeps its seed values unchanged.
export function mergeTeamIntelligence(teams) {
    const byId = new Map(teams.map((team) => [team.id, team]));
    return seededTeams.map((team) => ({ ...team, ...(byId.get(team.id) ?? {}) }));
}

// Builds the initial group order used before any simulation has run.
// Teams are sorted by their draw position (1–4) within each group.
// Accepts an optional teams array so it can be called with AI-adjusted data after fetch.
export function initialOrders(teams = seededTeams) {
    return "ABCDEFGHIJKL".split("").map((group) => ({
        group,
        slots: teams
            .filter((team) => team.group === group)
            .sort((a, b) => a.drawOrder - b.drawOrder)
            .map((team, index) => ({ position: index + 1, team })),
    }));
}

// ── Match schedule ────────────────────────────────────────────────────────────
// The official FIFA 2026 group-stage match order for each group.
// Each pair is [homeId, awayId] in the order matches are played.
// Used by MatchScores to display fixtures in the real schedule order instead of
// generating all pairs alphabetically.
export const groupMatchSchedule = {
    A: [
        ["mex", "rsa"],
        ["kor", "cze"],
        ["cze", "rsa"],
        ["mex", "kor"],
        ["cze", "mex"],
        ["rsa", "kor"],
    ],
    B: [
        ["can", "bih"],
        ["qat", "sui"],
        ["sui", "bih"],
        ["can", "qat"],
        ["sui", "can"],
        ["bih", "qat"],
    ],
    C: [
        ["hai", "sco"],
        ["bra", "mar"],
        ["bra", "hai"],
        ["sco", "mar"],
        ["sco", "bra"],
        ["mar", "hai"],
    ],
    D: [
        ["usa", "par"],
        ["aus", "tur"],
        ["tur", "par"],
        ["usa", "aus"],
        ["tur", "usa"],
        ["par", "aus"],
    ],
    E: [
        ["civ", "ecu"],
        ["ger", "cur"],
        ["ger", "civ"],
        ["ecu", "cur"],
        ["cur", "civ"],
        ["ecu", "ger"],
    ],
    F: [
        ["ned", "jpn"],
        ["swe", "tun"],
        ["ned", "swe"],
        ["tun", "jpn"],
        ["jpn", "swe"],
        ["tun", "ned"],
    ],
    G: [
        ["irn", "nzl"],
        ["bel", "egy"],
        ["bel", "irn"],
        ["nzl", "egy"],
        ["egy", "irn"],
        ["nzl", "bel"],
    ],
    H: [
        ["ksa", "uru"],
        ["esp", "cpv"],
        ["uru", "cpv"],
        ["esp", "ksa"],
        ["cpv", "ksa"],
        ["uru", "esp"],
    ],
    I: [
        ["fra", "sen"],
        ["irq", "nor"],
        ["nor", "sen"],
        ["fra", "irq"],
        ["nor", "fra"],
        ["sen", "irq"],
    ],
    J: [
        ["arg", "alg"],
        ["aut", "jor"],
        ["arg", "aut"],
        ["jor", "alg"],
        ["alg", "aut"],
        ["jor", "arg"],
    ],
    K: [
        ["por", "cod"],
        ["uzb", "col"],
        ["por", "uzb"],
        ["col", "cod"],
        ["col", "por"],
        ["cod", "uzb"],
    ],
    L: [
        ["gha", "pan"],
        ["eng", "cro"],
        ["eng", "gha"],
        ["pan", "cro"],
        ["pan", "eng"],
        ["cro", "gha"],
    ],
};
