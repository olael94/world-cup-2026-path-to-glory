# components/

UI components. Each file exports one focused component.

## Layout & Chrome
| File | Description |
|---|---|
| `Footer.jsx` | Site footer with disclaimer and GitHub link |

## Page Sections
| File | Description |
|---|---|
| `AiScoreboard.jsx` | Rotating banner that cycles through AI intel messages |
| `ControlDock.jsx` | Mode switcher, discipline slider, Calculate/Reset buttons |
| `GroupBoard.jsx` | Single group panel with draggable team slots and match results |
| `MatchScores.jsx` | Manual score entry grid, one section per visible group |

## Bracket & Standings
| File | Description |
|---|---|
| `Bracket.jsx` | Wildcard third-place table (`WildcardTable`) and full knockout bracket (`RoundOf32`) with drag-to-advance and SVG connectors |
| `Leaderboards.jsx` | Re-export shim — kept for backwards compatibility, points to `Bracket.jsx` |

## Team Detail
| File | Description |
|---|---|
| `TeamCard.jsx` | Compact team row with flag, ranking, momentum glow, and intel button |
| `CountryLabel.jsx` | Inline flag + name label (`CountryLabel`) and standalone flag mark (`FlagMark`) |
| `TeamIntelDrawer.jsx` | Slide-in panel with Elo/form stats, AI news items, players in/out, and coach notes |

## Onboarding
| File | Description |
|---|---|
| `Tutorial.jsx` | Step-by-step spotlight overlay that walks new users through the simulator |
