# MeiProof

MeiProof is an evidence-based invoice review prototype for sellers, buyers, and lenders. The app is a React 19, TypeScript, Vite 8, Tailwind CSS v4 frontend with a FastAPI workflow backend. Supabase Auth provides browser sessions when configured; authenticated claim and evidence actions send the session token to FastAPI. Demo login remains local and synthetic.

## Run locally

Use pnpm and the checked-in `pnpm-lock.yaml`:

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

Open [http://localhost:8443](http://localhost:8443). The Vite server binds to `127.0.0.1` by default. See [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md) for build, preview, and stop commands.

## Project map

- `src/` — React app and styles.
- `backend/` — FastAPI routes for claims, private evidence, extraction/verification, buyer responses, registry reservations, and lender reviews.
- `public/assets/meiproof-logo.png` — supplied MeiProof logo used by the shared brand and site icon.
- `docs/` — product specification, implementation status, and design references.
- `docs/figma/` — design handoff documentation; no Figma file URL has been supplied.
- `supabase/` — schema migration, private evidence bucket policies, local config, and synthetic seed.

Claim and workflow records in demo login remain synthetic. Authenticated actions use FastAPI when Supabase and backend configuration are available. Matching documents do not prove that a transaction occurred. See [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md), [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md), [docs/MEIPROOF_SPEC.md](docs/MEIPROOF_SPEC.md), and [docs/IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md) for setup and product boundaries.
