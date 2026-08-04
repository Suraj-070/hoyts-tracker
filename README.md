# HOYTS Last Session Tracker

Full Next.js web app — live HOYTS session data, last show per hall, all cinemas.

## Deploy

```bash
npm install
vercel deploy --prod
```

## Features
- Live sessions fetched server-side (no CORS)
- All 50 HOYTS cinemas
- D-BOX → XtremeScreen → Recliners ordering
- Click any hall to expand all sessions
- Book tickets directly from the app
- Date picker — browse any day
- Selling Fast / Sold Out badges
- Last session highlighted per hall
- Stats bar (total halls, sessions, latest finish)
- Remembers your cinema

## API Routes (built-in)
- `GET /api/hoyts/sessions?cinema=EGDENS`
- `GET /api/hoyts/film?id=HO00010000`
- `GET /api/hoyts/films?ids=HO00010000,HO00010001`
- `GET /api/hoyts/cinemas`
