# lib/

Data, utilities, and API layer. No React — all files are plain JavaScript and fully testable in isolation.

| File | Description |
|---|---|
| `api.js` | Fetch wrappers for the backend — `fetchTeams()` and `simulate()` |
| `seedData.js` | Source of truth for the 48 teams, group themes/colors, `groupStyle()`, `initialOrders()`, `mergeTeamIntelligence()`, and the per-group match schedule |
| `bracket.js` | Pure bracket-building logic — pairing winners, applying picks, computing SVG connector paths, and traversing descendant fixtures |
| `scores.js` | Helpers that build the manual-score payload sent to the simulator from either React state or live DOM inputs |

## generated/
Auto-generated files produced by `scripts/build_historical_ratings.py`. Do not edit by hand.

| File | Description |
|---|---|
| `historicalRatings.json` | Elo ratings and form scores derived from historical international match results |
