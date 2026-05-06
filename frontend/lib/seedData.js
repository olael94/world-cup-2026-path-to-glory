import historicalRatings from "./generated/historicalRatings.json";

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
    elo: historicalRatings.teams[id]?.elo ?? fallbackElo(Number(ranking)),
    form: historicalRatings.teams[id]?.form ?? 50,
    historicalMatches: historicalRatings.teams[id]?.historicalMatches ?? 0,
}));

export const flagByTeamId = Object.fromEntries(seededTeams.map((team) => [team.id, team.flag]));
export const flagImageByTeamId = Object.fromEntries(
    seededTeams.map((team) => [team.id, team.flagImage])
);
export const teamByName = Object.fromEntries(seededTeams.map((team) => [team.name, team]));

function fallbackElo(ranking) {
    return 1500 + Math.max(0, 90 - ranking) * 4;
}

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

export function groupTheme(group) {
    return groupThemes[group] ?? { color: "#71e5b7", rgb: "113, 229, 183", name: "Default" };
}

export function groupStyle(group) {
    const theme = groupTheme(group);
    return {
        "--group-color": theme.color,
        "--group-rgb": theme.rgb,
        "--group-ink": readableInk(theme.rgb),
    };
}

function readableInk(rgb) {
    const [red, green, blue] = rgb.split(",").map((part) => Number(part.trim()) / 255);
    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    return luminance > 0.48 ? "#020504" : "#ffffff";
}

export function mergeTeamIntelligence(teams) {
    const byId = new Map(teams.map((team) => [team.id, team]));
    return seededTeams.map((team) => ({ ...team, ...(byId.get(team.id) ?? {}) }));
}

export function initialOrders(teams = seededTeams) {
    return "ABCDEFGHIJKL".split("").map((group) => ({
        group,
        slots: teams
            .filter((team) => team.group === group)
            .sort((a, b) => a.drawOrder - b.drawOrder)
            .map((team, index) => ({ position: index + 1, team })),
    }));
}

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
