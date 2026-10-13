# MeiProof — Codex Implementation Brief (Phase 1)
**Goal:** Turn the current Figma Make export into a maintainable, genuinely interactive frontend without losing the new visual direction.

## Read first
Inspect the repository before editing:
- `src/App.tsx`
- `src/index.css`
- `src/main.tsx`
- `package.json`
- `AGENTS.md`
- the MeiProof MVP specification supplied by the user

The current project is a React 19 + TypeScript + Vite + Tailwind CSS v4 app. It currently keeps route state in `App.tsx` rather than the URL and has a large single-file implementation. The existing route inventory includes public pages, auth/registration, seller/buyer/lender workflows, claims, verification, registry/reservation, risk, decisions, audit, account and system states.

## Working rules
1. Do not redesign from scratch or delete routes to simplify the task.
2. Preserve the MeiProof visual direction: editorial Fraunces-style display headlines, legible Inter/Satoshi-style UI, IBM Plex Mono for IDs/hashes, charcoal/cream/sage/deep-green/sand palette, restrained motion.
3. No generic gradients, glowing blobs, excessive glassmorphism, repetitive KPI cards, fake live data, fake partner logos, or unsupported integrations.
4. Do not claim backend, authentication, blockchain, or registry operations are real unless the code actually calls the relevant service and handles failures.
5. Keep demo data explicitly labelled. Never let document matching imply an invoice is genuine.
6. Keep transaction-integrity risk and buyer-payment risk separate.
7. Preserve role distinctions: seller, buyer, lender. UI role selection is not authorization.
8. Do not install dependencies without a clear need. If adding a router, choose one lightweight conventional solution and migrate all existing routes.
9. Make small, reviewable changes; after each phase run format/typecheck/build if scripts exist and report exact results. Do not claim tests passed if they were not run.

## Phase 1 scope: route and interaction foundations
Before implementing backend services, make the frontend navigable, maintainable, and honest.

### A. URL routing
- Replace React-state-only navigation with URL-aware routing and browser Back/Forward support.
- Preserve all current routes:
  `landing`, `platform`, `how`, `trust`, `faq`, `contact`, `legal`,
  `login`, `register`, `verify-email`, `access-pending`, `forgot`, `reset`, `session-expired`,
  `dashboard`, `claims`, `new-claim`, `claim-detail`, `verification`, `documents`, `buyer-response`,
  `inbox`, `response-history`, `review-queue`, `review`, `risk`, `decision`,
  `registry`, `registry-match`, `reservation`, `reservation-conflict`, `registry-history`,
  `audit`, `anchor`, `integrity`, `notifications`, `profile`, `security`, `help`, `search`,
  `states`, `access-denied`, `not-found`, `unavailable`.
- Direct URL load must render the correct page. Unknown paths should render `not-found`. Refresh and browser Back/Forward must work.
- Use a central route map and avoid scattered string comparisons where practical.
- If a router dependency is added, explain why and update `package.json`/lockfile correctly.

### B. Extract the large app into components
- Split `App.tsx` into a small route/layout entry, shared components, and feature/page modules.
- Keep shared primitives (Button, Badge, Field, SelectField, Modal, PageHeader, AppShell, tables/timeline) reusable.
- Do not over-abstract every tiny element. Keep domain workflows easy to follow.
- Preserve visual appearance while refactoring; do not mix a major visual redesign into the routing refactor.

### C. Fix clearly dead interactions and false affordances
Audit every visible control in the current app. Ensure every primary button and navigation item either:
- performs its stated local prototype action and visibly updates state,
- navigates to the relevant route,
- or is explicitly disabled/labeled “Not available in this prototype”.

Specifically inspect:
- Login and registration steps.
- Registration values retained across steps and shown on the review step.
- Forgot/reset password forms and success/error states (prototype-only; do not imply email was actually sent).
- Claim wizard fields, step navigation, and document picker.
- Registry search input; search action must respond to entered text against the available demo dataset, not always show a predetermined result.
- Reservation modal: open it from the appropriate control; success and conflict should be distinct, labelled demo outcomes. Do not claim atomic backend reservation.
- Profile/security save buttons; either implement meaningful local demo feedback or clearly disable unavailable service-dependent actions.
- Notifications: click opens the related record; read/unread state can be simulated and labelled.
- Search page: query should filter the local demo records.
- Modal behavior: close button/cancel, Escape, and keyboard focus should work; don't allow clicks on the backdrop to trigger confirm.
- Logout must clear any demo session/role state and return to login or landing with an honest demo message.

### D. Truthful demo states
- Add a small, consistent “Demo data” label in the authenticated workspace.
- Where screens mention backend confirmation, saved audit event, real blockchain anchoring, email sent, or a persistent decision, ensure the wording says “demo/simulated” unless real integration exists.
- Do not use realistic-looking fabricated blockchain transaction hashes without a visible demo label.
- Keep existing helpful caveats about registry coverage and hash limitations.

### E. Visual preservation and accessibility
- Preserve the new dark/cream/sage visual direction and font hierarchy.
- Maintain semantic buttons, form labels, keyboard focus, reduced-motion preferences, and mobile layouts.
- Do not introduce decorative animation in this phase.
- Avoid unnecessary dependencies.

## Acceptance criteria
- [ ] All listed routes work by direct URL and internal navigation.
- [ ] Browser Back/Forward and refresh work.
- [ ] Unknown URL reaches a designed not-found page.
- [ ] No primary visible button is a silent no-op.
- [ ] Registration fields persist across steps and appear accurately in review.
- [ ] Search uses the typed query against demo records.
- [ ] File picker opens and selected file names/status are shown, with clear demo-only processing.
- [ ] Reservation success/conflict are honest local prototype states and clearly labelled as simulated.
- [ ] Login/logout is clearly a demo until Supabase is integrated; no UI-only role change is presented as secure auth.
- [ ] No copy falsely claims real backend persistence, real email delivery, or a real blockchain transaction.
- [ ] Existing page coverage and styling are retained.
- [ ] Build/typecheck/format checks are run if available; report the actual output.

## Deliverable
Implement Phase 1 in the existing repository. At the end, provide:
1. A concise list of files changed.
2. A route-by-route summary of navigation fixes.
3. A list of interactions that now work locally.
4. A list of remaining simulated integrations.
5. Exact build/typecheck/test results, including any failures.
6. Do not begin Supabase/backend integration until this phase is stable and reviewed.
