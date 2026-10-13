# MeiProof — Codex Project Instructions

## Product and workflow
MeiProof is an evidence-based invoice-verification and financing-risk prototype for sellers, buyers, and lenders. Read `docs/MEIPROOF_SPEC.md` before changing product behavior. `docs/IMPLEMENTATION_STATUS.md` records known state and should be updated after meaningful work. `docs/DESIGN_SYSTEM.md` is the visual source of truth. `docs/CODEX_PHASE_1.md` is the first implementation task.

Use this workflow: inspect → plan → implement small changes → run checks → report results. Figma is the design source of truth, Codex implements and maintains the real repository, and ChatGPT is used for planning/art direction. Preserve useful existing code and every declared route unless a documented change is necessary.

## Visual direction (must follow)
- Distinctive, polished, art-directed interface; never generic AI-generated SaaS styling.
- Display: Fraunces (or available close editorial serif). UI/body: Inter or Satoshi-like sans serif. IDs, hashes, timestamps: IBM Plex Mono or a close monospace.
- Palette: ink/charcoal, warm paper/cream, sage, deep green, sand, semantic amber and red. See `docs/DESIGN_SYSTEM.md`.
- Visual concept: “evidence desk” — document provenance, precise field comparison, financial data clarity, audit ledger.
- Research/inspiration ecosystem: Motion.dev, Kokonut UI, React Bits, Manus, A1.gallery/Bevel, Land-book, Awwwards; use shadcn/ui, Radix, 21st.dev, Lucide, Tailwind, and GSAP/Motion only when appropriate.
- Avoid generic purple/blue gradients, glowing blobs, gratuitous glassmorphism, repetitive bento grids, repeated identical KPI cards, fake dashboards, invented logos/stats, decorative animation, cursor trails, scroll hijacking, and meaningless motion.
- React Bits is a selective toolbox, not the design system. Motion must be purposeful and respect `prefers-reduced-motion`.
- Preserve current design direction while doing architecture/functional refactors; don't mix unrelated redesign into a routing change.

## Technical rules
- Current base: React 19, TypeScript, Vite 8, Tailwind CSS v4, pnpm lockfile. Inspect actual package files before assuming scripts or adding dependencies.
- Do not add a dependency without a reason. If routing is introduced, update `package.json` and `pnpm-lock.yaml` consistently.
- Keep code modular and readable. `src/App.tsx` is currently large; refactor in small steps rather than one destructive rewrite.
- Never claim an integration is real unless implemented and verified. Label demo/synthetic data and simulated outcomes.
- Never place Supabase service-role keys, blockchain private keys, or other secrets in frontend code or commit them.
- Authentication/authorization must eventually be enforced by the backend and database policies, not by hidden buttons or UI role selection.
- Use private document storage and server-side checks. Preserve auditability and file-version integrity.
- No lender should be able to grant themselves lender permissions by choosing a role during registration.

## Product truth / safety rails
- Document matching does not prove a transaction occurred or an invoice is genuine.
- Buyer confirmation is a separate response and is not a guarantee of payment.
- Keep transaction-integrity risk separate from buyer-payment risk.
- Exact file hash, normalized invoice identity, and similarity candidate are different duplicate signals; explain the reason.
- The shared registry covers participating/demo records only, not all lenders globally.
- Hashes prove integrity relative to a recorded fingerprint, not truth at upload.
- Keep sensitive files off-chain; only anchor hashes/manifests and relevant references.
- Lender makes the final financing decision; do not imply automatic disbursement.
- Synthetic payment histories and buyer confirmations must be labelled demo data.

## Quality bar
- Every visible primary control must work, navigate, or be explicitly disabled with an explanation.
- Preserve all current routes listed in `docs/IMPLEMENTATION_STATUS.md`.
- Check desktop and mobile layout, empty/loading/error/permission/conflict/success states, keyboard focus, persistent labels, and reduced motion.
- Run available format/typecheck/build/tests after changes. Report exact commands and results. Never claim a check passed if it was not run.
- Update `docs/IMPLEMENTATION_STATUS.md` when a feature or phase changes. Record what's real, what's simulated, what remains, and known failures.
