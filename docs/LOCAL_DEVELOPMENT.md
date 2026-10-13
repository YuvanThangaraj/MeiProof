# Local development

## Requirements

- Node.js compatible with the Vite version in `package.json`.
- pnpm.
- Supabase is optional for the local demo. Without credentials, the frontend uses its clearly labelled local demo workspace. With public Supabase variables configured, Auth uses Supabase and authenticated workflow actions call FastAPI.

The frontend project root is `MeiProof_Codex_Project_Pack/`, the directory containing `package.json` and `pnpm-lock.yaml`. The current Vite configuration uses port `8443` and binds to `127.0.0.1` unless `PORT` or `FIGMA_DEV_SERVER_HOST` is set.

For the Daniel pitch account, run FastAPI from `backend/` so it loads `backend/.env`; the account exchange is limited to development and loopback. If ports 8443/8000 are already occupied, this workspace's current local setup uses Vite on `http://127.0.0.1:8444` and FastAPI on `http://127.0.0.1:8001`, with matching `VITE_API_BASE_URL` and `CORS_ORIGINS` values in the ignored environment files.

## Install and run

From the frontend project root in PowerShell:

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

Open <http://localhost:8443>. Use `Ctrl+C` in the terminal to stop Vite.

Start the backend in a second PowerShell window from `backend/`:

```powershell
py -m pip install -r requirements.txt
py -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The frontend defaults to `http://127.0.0.1:8000`. Set `VITE_API_BASE_URL` in `.env.local` to change it. FastAPI allows the local Vite origins on port 8443; set `CORS_ORIGINS` on the backend for other origins. Authenticated workflow endpoints also need backend Supabase settings and a valid approved user session.

For Supabase setup, Auth redirects, migrations, and security boundaries, see [SUPABASE_SETUP.md](SUPABASE_SETUP.md).

## Production build and preview

```powershell
pnpm build
pnpm preview
```

Preview uses port `8443` by default, so stop the development server first. To preview on another port, for example `4173`:

```powershell
$env:PORT = '4173'
pnpm preview
```

Open <http://localhost:4173>. Stop the preview server with `Ctrl+C`.

## Available checks

```powershell
pnpm exec tsc --noEmit
pnpm build
pnpm exec oxfmt --check src/App.tsx src/index.css vite.config.ts
```

There is no test script in `package.json`. The formatter check has a known issue documented in `docs/IMPLEMENTATION_STATUS.md`; do not run a mutating formatter on `src/App.tsx` without rechecking TypeScript.

## Routing and limitations

The Vite development server serves the app shell for direct route loads. The client route map renders the relevant MeiProof screen and handles browser history. This setup does not configure SPA rewrites for an external production host. In demo login, workflow actions remain local simulations. In an authenticated workspace, claim listing/creation, evidence upload, extraction/verification, buyer response, lender review, and registry reservation call FastAPI. Audit event retrieval, persistent profile/preferences, and blockchain anchoring are not connected. Password reset email delivery requires project email configuration and has not been tested.
