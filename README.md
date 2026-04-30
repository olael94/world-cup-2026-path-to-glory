# 2026 World Cup Path to Glory

A three-service tournament simulator for the 48-team 2026 World Cup:

- `frontend`: Next.js, Tailwind CSS, Framer Motion drag-and-drop tracker.
- `backend`: Spring Boot orchestrator with JPA `TournamentSnapshot`, `GroupResult`, and `MatchResult` persistence.
- `math-service`: FastAPI Elo/Poisson momentum engine.

## Run Locally

```bash
docker compose up --build
```

Then open:

- Frontend: `http://localhost:3000`
- Spring Boot API: `http://localhost:8080`
- FastAPI docs: `http://localhost:8000/docs`

## Notes

The app seeds all 12 groups and 48 teams in `frontend/lib/seedData.js` and `backend/.../SeedData.java`. Rankings are intentionally isolated in one place so the April 2026 FIFA ranking snapshot can be replaced without touching simulation logic.

Initial Elo and form are generated from historical international results with:

```bash
python3 scripts/build_historical_ratings.py
```

Historical results are a stable baseline. They should be regenerated only when the source dataset changes, new completed matches are intentionally added, or the Elo/form formula changes.

The backend also has a daily AI refresh layer on `GET /teams`. Set `OPENAI_API_KEY` before starting the backend to let it gather only current team news and conditions with OpenAI, cache the result for 24 hours, and blend those news signals into the historical Elo/form baseline. The AI refresh should focus on injuries, squad availability, coaching/tactical changes, morale, recent friendlies/qualifiers, and likely World Cup readiness. Without `OPENAI_API_KEY`, it safely falls back to the generated historical ratings.
