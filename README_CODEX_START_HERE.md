# MeiProof — Codex Project Pack

This folder is intended to be opened as the project workspace in Codex. It contains the current React/Vite frontend plus the persistent context needed to continue MeiProof without depending on chat history.

## Start here
1. Read `AGENTS.md`.
2. Read `docs/MEIPROOF_SPEC.md` for product behavior and hard constraints.
3. Read `docs/DESIGN_SYSTEM.md` for the design direction.
4. Read `docs/IMPLEMENTATION_STATUS.md` for known status and next tasks.
5. Follow `docs/CODEX_PHASE_1.md` for the first implementation phase.

## First prompt to Codex
“Read `AGENTS.md`, `README_CODEX_START_HERE.md`, and all files in `docs/` before editing. Inspect the current code and package scripts. Follow `docs/CODEX_PHASE_1.md` exactly. Start by reporting a short implementation plan and any repository inconsistencies, then implement Phase 1 in small steps. Preserve the current visual design and every declared route. Run the available checks and report exact results; do not claim simulated integrations are real.”

## Important
- The UI is not proof that a backend integration exists. Verify code before claiming behavior.
- Do not commit secrets or real credentials. Use `.env.example` for variable names only.
- Keep this status file updated after each meaningful phase.
- The reference images in `docs/reference-images/` are visual guidance; rebuild them as editable UI, do not paste them into the app.
