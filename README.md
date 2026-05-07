# 2026 World Cup — Path to Glory

![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Framer Motion](https://img.shields.io/badge/Framer_Motion-11-0055FF?style=flat-square&logo=framer&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=flat-square&logo=python&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)
![OpenAI](https://img.shields.io/badge/GPT--4.1_mini-412991?style=flat-square&logo=openai&logoColor=white)

An unofficial fan-made simulator for the 48-team FIFA World Cup 2026. Drag teams into your predicted group order, enter any known scores, run the simulation, and watch the full bracket build itself — wildcards, round of 32, and beyond.

Built with a **Next.js frontend** and a **FastAPI + PostgreSQL backend**. An optional AI layer uses GPT-4 to pull current team news (injuries, form, coaching changes) and blend it into the historical Elo/form baseline before every simulation.

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 15, Tailwind CSS, Framer Motion |
| Backend | FastAPI, SQLAlchemy, PostgreSQL |
| Simulation | Elo rating system + Poisson goal model |
| AI Intel | GPT-4.1 mini via LangChain + web search |
| Containerisation | Docker Compose |

---

## Run Locally

```bash
docker compose up --build
```

Then open:

- **Frontend:** `http://localhost:3000`
- **Backend API:** `http://localhost:8000`
- **API docs:** `http://localhost:8000/docs`

To enable AI-powered team intelligence, set your OpenAI key before starting:

```bash
export OPENAI_API_KEY=sk-...
docker compose up --build
```

Without the key the app falls back to historical ratings — everything still works.

---

## Project Structure

```
├── frontend/               # Next.js app
│   ├── app/                # Page and global CSS
│   ├── components/         # UI components (Bracket, GroupBoard, TeamCard…)
│   └── lib/                # Utilities (seedData, bracket logic, API client)
│
└── backend/                # FastAPI app
    └── app/
        ├── main.py             # API routes
        ├── simulation.py       # Elo + Poisson match engine
        ├── intelligence.py     # AI news fetch and rating adjustment
        ├── intel_config.py     # Trusted sources, team aliases, retired players
        ├── database.py         # SQLAlchemy models and session setup
        ├── response_builders.py# Formats DB snapshots for the frontend
        ├── models.py           # Pydantic request/response models
        └── seed_data.py        # 48-team baseline with Elo and form ratings
```

---

## How the Simulation Works

1. **Group stage** — Every group runs a full round-robin. Match scores are predicted using each team's Elo rating, FIFA ranking, and recent form via a Poisson goal model. Manual scores entered by the user override the model for specific matches.
2. **Elo updates** — After each match, both teams' Elo ratings update immediately, so later group matches reflect earlier results.
3. **Standings** — Teams are sorted by the official FIFA tiebreaker order: points → goal difference → goals scored → fair play → original draw position.
4. **Wildcards** — All 12 third-place finishers are ranked by the same tiebreaker rules. The best 8 advance to the round of 32.
5. **Bracket** — The round of 32 follows the official FIFA 2026 fixture map. Users pick winners by clicking or dragging team names through the bracket.

---

## AI Team Intelligence

When `OPENAI_API_KEY` is set, the backend runs a GPT-4 web search for current news on all 48 teams before each simulation. It looks for:

- Injuries and player availability
- Recent form from friendlies and qualifiers
- Coaching or tactical changes
- Squad morale and readiness

The AI adjusts each team's Elo and form score based on what it finds, then caches the result for 24 hours to avoid redundant API calls. Results are shown in the Team Intel drawer (tap the arrow on any team card).

---

## Historical Ratings

Initial Elo and form values are generated from a dataset of historical international results:

```bash
python3 scripts/build_historical_ratings.py
```

This writes to `frontend/lib/generated/historicalRatings.json`. Regenerate only when the source dataset changes, new completed matches are added, or the Elo/form formula is updated.

---

## Code Quality

All commands run from the `frontend/` directory.

```bash
npm run lint          # Check for ESLint issues
npm run lint:fix      # Auto-fix what ESLint can
npm run format        # Prettier format all .js, .jsx, .json, .css files
```

From the `backend/` directory:

```bash
ruff check .          # Lint
ruff format .         # Format
```

---

## Disclaimer

Unofficial fan project. Not affiliated with or endorsed by FIFA.
