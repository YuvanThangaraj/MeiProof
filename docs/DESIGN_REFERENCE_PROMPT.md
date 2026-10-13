# MeiProof — Premium Visual Redesign Prompt for Figma
**Version:** 5.0  
**Deliverable:** Complete, implementation-ready redesign of the existing MeiProof frontend  
**Design reference assets:** Upload the generated MeiProof styleboard images alongside this file  
**Source of truth:** Existing MeiProof reference ZIP + MeiProof MVP specification

---

## Mission

Redesign MeiProof so it looks like a deliberately art-directed, premium product—not a generic AI-generated fintech template.

MeiProof helps businesses, buyers, and lenders inspect invoice evidence, confirm transactions, assess risk, detect potential duplicate financing, and review tamper-evident audit records. Its visual identity should communicate **evidence, precision, trust, and consequential decisions**.

Do not start by adding gradients, shadows, rounded cards, or animations. Start with art direction, typography, composition, and meaningful product hierarchy. Preserve existing product coverage and improve the interface in place.

## 1. Inspect before designing

Read all supplied materials before editing:

1. **Existing MeiProof frontend ZIP** — inspect the React/Vite implementation, current route inventory, components, styles, and interactions. Preserve useful domain-specific content and existing working components.
2. **MeiProof MVP specification** — authoritative source for product behavior, role permissions, verification rules, registry limits, audit and blockchain behavior.
3. **This prompt** — authoritative source for visual direction and design quality.
4. **The uploaded styleboard images** — visual inspiration for typography, palette, composition, surfaces, and product screens. Use them as references, not as images to paste into the finished UI.

Do not replace the project with a landing-page-only mockup. Do not discard useful pages simply because the current styling is weak. Map the existing route inventory to the redesigned screens and report any route that cannot be found.

## 2. Visual concept: “Evidence, made tangible”

The central design idea is a carefully composed **evidence desk**: a modern financial workspace where invoices, purchase orders, delivery records, buyer responses, risk indicators, and audit events can be inspected side by side.

Mix:
- Editorial, high-contrast typography for public-facing storytelling.
- Warm paper-like surfaces and precise rules for document-focused work.
- Deep charcoal navigation and focused dark panels where they improve hierarchy.
- Clean, highly legible tables for financial records.
- Realistic document previews and field-by-field evidence comparisons.
- Restrained, meaningful motion for feedback and transitions.

The product should feel like a serious, well-designed financial research/workflow tool, not a crypto casino, generic banking dashboard, or AI startup template.

### Do not use
- Generic purple/blue gradient backgrounds.
- Glowing blobs, ambient neon orbs, or decorative mesh gradients.
- Glassmorphism everywhere.
- The same row of three/four rounded KPI cards on every page.
- Repetitive bento grids as the default layout.
- Identical cards repeated across all sections.
- Fake charts, fake live metrics, or fake partner logos.
- Random 3D objects that do not explain the product.
- Over-animated dashboards, cursor trails, particles, scroll hijacking, or perpetual loops.
- Unexplained “AI confidence” numbers.
- Claims that blockchain proves an invoice is genuine.

## 3. Brand system

### Palette

Use Figma color variables and semantic tokens. Use the following palette as the base:

| Token | Hex | Purpose |
|---|---|---|
| Ink / primary dark | `#0B0F0E` | Dark navigation, key headings, focus panels |
| Charcoal | `#1A1C1F` | Secondary dark surfaces |
| Paper | `#F7F6F2` | Main light canvas |
| White | `#FFFFFF` | Focused work surfaces |
| Sage | `#A8BA90` | Positive states and quiet accents |
| Deep green | `#2E713E` | Confirmed/success actions and states |
| Sand | `#D4C0A0` | Secondary accent and warm detail |
| Amber | `#D7A65A` | Pending, caution, review-needed |
| Red | `#D94A4A` | Disputes, hard conflicts, integrity failures |
| Muted text | `#737873` | Secondary labels and metadata |
| Border | `#D9DAD4` | Rules, tables, form boundaries |

Use semantic colors consistently. Red means a meaningful problem; amber means caution/pending; green means a specific check passed. Never communicate status through color alone.

Primary actions should normally be dark ink with white text or deep green. Sage can highlight a selected state or a successful check. Sand/amber is an accent, not a full-page background. Do not use a generic purple CTA system.

### Typography — change it decisively

Use a contrasting, deliberate type system:
- **Display/headlines:** `Fraunces` (or `Canela` if available) for public-page headlines and a few editorial moments.
- **Product UI/body:** `Inter` or `Satoshi` for legible controls, labels, forms, tables, and body copy.
- **Identifiers/data:** `IBM Plex Mono` for invoice IDs, hashes, transaction references, timestamps, and technical metadata.

Use large serif typography for the public hero and selected section titles; use a clear sans-serif for all operational screens. Do not use the same oversized display font for dashboards. Use tabular numerals for amounts and metrics. Define complete type styles and hierarchy: hero, display, page title, section title, body, label, table heading, helper, metadata, and monospace value.

If a preferred font is unavailable in the target environment, choose a close, available alternative and record it in the handoff.

### Layout, spacing, and surfaces
- Use a 12-column desktop grid with deliberate asymmetry for marketing pages.
- Use an 8-point spacing scale.
- Main content width should generally be 1120–1320 px depending on the screen.
- Use mostly 6–12 px corner radii; do not make every surface pill-shaped.
- Prefer crisp borders, subtle tonal shifts, strong alignment, and whitespace over heavy shadows.
- Use a few carefully selected dark panels, not a dark rectangle behind every component.
- Keep content density appropriate to the task: evidence tables can be dense; onboarding should be calm; decisions should have breathing room.
- Use real document-sheet layouts, rules, field labels, and stamps as visual motifs.
- Do not add texture if it harms readability.

## 4. Use the uploaded image references correctly

Treat the generated MeiProof styleboards as **visual references**, not complete page assets. Extract the principles:
- High-contrast dark/cream composition.
- Serif headlines paired with restrained sans-serif UI.
- Sage/deep-green and sand accents.
- Evidence documents as the core hero object.
- Detailed, believable operational screens.
- Clear distinction between public marketing and authenticated product UI.

Do not copy tiny unreadable text from the boards. Do not use the full board as a page background. Rebuild each interface as editable components and real text. Replace any unsupported stats, fake brands, fake logos, or invented integrations with actual MVP-grounded content or remove them.

If the styleboard suggests unsupported functionality (e.g., social login, a verified score, a global lender network, or a real blockchain anchor), do not copy the claim unless it exists in the supplied source/project. Label demo-only content honestly.

## 5. Landing page: make it memorable

Retain the useful existing content, but redesign its composition with a confident editorial layout.

Suggested copy direction:
- Eyebrow: `TRACE · VERIFY · FINANCE`
- Headline: **“Proof moves capital.”**
- Supporting text: “MeiProof helps sellers, buyers, and lenders review invoice evidence, identify inconsistencies, and keep an auditable record of important decisions.”
- Primary CTA: `Get started`
- Secondary CTA: `Explore the workflow`

This copy is a direction, not a requirement to use unsupported promises. Avoid “revolutionize,” “unlock the power of AI,” and similar generic copy.

Hero composition:
- Left: headline, concise explanation, clear CTAs.
- Right: a carefully art-directed evidence composition made from editable UI fragments: an invoice sheet, supporting document tabs, a field-match list, and a compact evidence-status ledger.
- Use dark charcoal/ink background with carefully controlled paper/stone imagery or a document-focused composition. Avoid a generic gradient orb.
- Add a small, accurate “How it works” sequence: Submit evidence → Compare records → Buyer responds → Lender reviews → Audit event recorded.
- Use distinct editorial layouts for product capabilities rather than identical feature cards.
- Include trust/limitations copy: document agreement does not prove truth; registry checks only cover available participating records; hashes prove integrity relative to a recorded fingerprint, not truth at upload.
- Do not invent customer logos, partner endorsements, volume stats, accuracy claims, or financing outcomes. If sample numbers are needed for prototype visuals, mark them as sample/demo data.

Public pages required: Landing, Platform, How It Works, Trust, FAQ, Contact, Legal.

## 6. Authentication and registration

Design complete, responsive, connected screens:
- Login
- Registration step 1: account details
- Registration step 2: organization details
- Registration step 3: requested role and access explanation
- Registration step 4: review and submit
- Email verification
- Access pending / role approval pending
- Registration rejected / more information needed
- Forgot password
- Reset password
- Session expired
- Access denied

Use a calm, paper-based form surface with a dark ink panel or a focused single-column form. Use one signature document/ledger visual, not generic abstract art. Persistent field labels are required; never rely on placeholders alone.

Include:
- Password reveal and password guidance.
- Inline validation, disabled and loading states, duplicate-email errors, network errors, and success states.
- Step progress, Back/Continue, and preserved values between steps.
- Organization and role summary on the review step.
- Clear explanation that role selection is a request, not permission to self-assign lender access.
- Mobile layout that becomes one column.
- No social-login buttons unless the real project supports them.

## 7. Authenticated application shell

Build a consistent, role-aware shell with:
- MeiProof wordmark.
- Role-specific navigation.
- Current organization/context where supported.
- Page title and concise task explanation.
- Search only where it has a defined scope.
- Notifications, profile, and logout.
- Breadcrumbs on multi-level workflows.
- Responsive sidebar/drawer.

Avoid a dashboard full of meaningless metrics. Every summary number must map to actual or explicitly demo-labelled data and link to its underlying records.

### Seller workspace
Prioritize claim creation, submitted claims, evidence requests, verification progress, and next actions. Design:
- Seller dashboard
- Claims list and filters
- New claim wizard
- Invoice/counterparty details
- Document upload and upload progress
- Extracted-field review/correction
- Claim detail
- Verification findings
- Buyer response status
- Audit history

### Buyer workspace
Prioritize claims awaiting a response and disputed/correction cases. Design:
- Buyer dashboard
- Incoming claims/inbox
- Buyer claim detail
- Compare seller-submitted evidence
- Confirm claim
- Dispute claim with required reason
- Request correction with message
- Confirmation dialog and success/failure
- Response history

The seller must not be able to submit a buyer response on the buyer’s behalf.

### Lender workspace
Prioritize the queue of decisions, unresolved evidence, buyer-payment risk, and registry conflicts. Design:
- Lender dashboard
- Review queue and filters
- Lender claim review
- Evidence comparison
- Transaction-integrity risk
- Buyer-payment/receivables risk
- Registry check
- Reservation workflow
- Reservation conflict
- Decision form and rationale
- Decision confirmation
- Portfolio/history if supported by existing data

Lender decisions must not imply automatic fund disbursement.

## 8. The signature screen: evidence comparison

This should be the most thoughtfully designed operational screen.

Use a structured split-pane workspace:
1. **Document rail:** invoice, purchase order, delivery receipt, contract, other evidence; display file name and processing state.
2. **Document preview:** a realistic editable document sheet with zoom controls and clear source label.
3. **Comparison area:** field-level rows comparing values across available documents.
4. **Decision rail:** verification state, buyer response, transaction-integrity risk, payment risk, registry result, and next action.

For every mismatch, show:
- Field name.
- Value in each source.
- Source label.
- Difference/severity.
- Short explanation.
- Suggested next action.

Use states such as Match, Mismatch, Missing, Uncertain extraction, Not checked, and Independently corroborated. Do not use a single vague “AI flagged risk” alert. A document match is not proof that the transaction is genuine.

On mobile, make the document/source selection and comparison a guided stacked flow instead of shrinking the desktop split pane.

## 9. Registry and double-financing flow

Design:
- Registry search.
- Search results.
- Candidate match detail.
- Match reason and provenance.
- Current registry status.
- Reservation confirmation.
- Reservation success.
- Reservation conflict.
- Registry history.

Differentiate:
- Exact file-hash match.
- Normalized supplier + buyer + invoice number match.
- Similarity candidate based on available fields.

Never label a similarity candidate as proven fraud. Explain the matching basis and the scope of records checked.

The conflict state should be visually clear and decisive: explain that another lender has already reserved/financed the claim in the shared demo registry, show available details, block a second reservation, and offer a safe next action. State that this registry does not cover every lender globally.

Reservation must be atomic in the real implementation. In a Figma prototype, demonstrate success and competing-reservation conflict as separate explicit states.

## 10. Risk and lender decisions

Keep these separate:
- **Transaction integrity:** mismatches, missing documents, duplicates, buyer confirmation, provenance, and file integrity.
- **Buyer payment risk:** historical on-time payment, lateness, overdue receivables, and outstanding exposure.

Do not use decorative circular gauges as the primary explanation. Prefer a labeled severity, compact scale, evidence-based reason list, source/data coverage, and clear limitations. Never invent a validated credit score or unsupported confidence percentage.

Decision options may include request more evidence, hold, reject, or mark ready/approved for lender review, according to the actual MVP. Show a review summary before confirmation and record the rationale in the intended workflow. Do not present a demo decision as a bank commitment.

## 11. Audit and blockchain

Design:
- Audit timeline/ledger.
- Event detail.
- File fingerprint display.
- Integrity check.
- Manifest details.
- Anchor status.
- Transaction reference.
- Anchor failure/retry.
- Integrity mismatch.

Show time, actor, event, target, outcome, and reference. Use monospace for SHA-256 values, IDs, block numbers, and transaction hashes. Provide copy affordances and a full-value view for truncated hashes.

Statuses: Not anchored, Queued, Pending, Anchored, Failed, Integrity mismatch, Provider unavailable.

Only show chain ID, contract address, block number, and explorer link when actual values exist. If prototype-only, use clearly labelled demo values. Never imply a hash proves the original document content was truthful.

## 12. Component library — use React Bits selectively

Create a coherent MeiProof component library before applying effects. The visual identity must remain usable without animation.

### Foundations
- Color variables and semantic status tokens.
- Typography styles.
- Spacing and layout grid.
- Radius, border, elevation, and focus tokens.
- Motion durations/easing and reduced-motion rules.

### Core components
- Buttons: primary, secondary, ghost, danger, icon-only, loading, disabled.
- Inputs: text, email, password reveal, search, select, textarea, checkbox, radio.
- Form stepper and field validation.
- Status badges with icon + text.
- Alert, toast, confirmation dialog, drawer, tooltip.
- App shell, sidebar, top bar, breadcrumbs, page header.
- Claim table, sortable header, filter bar, pagination, empty result.
- Evidence document item, preview sheet, extraction field, comparison row, source tag.
- Risk panel, reason list, decision summary, decision action group.
- Registry match item, reservation lifecycle, conflict panel.
- Audit event, event detail, hash display/copy, anchor status.
- Loading skeleton, empty, error, permission denied, conflict, success, unavailable.

Use shadcn/ui/Radix patterns where appropriate for accessible primitives; Lucide for a consistent icon family; Tailwind for layout/styling. Do not install or imitate every library. Use React Bits only for selected signature interactions.

### React Bits/motion — maximum 3–4 signature patterns
1. Subtle text reveal for the public hero only.
2. Count-up for real or clearly demo-labelled metrics when entering view.
3. One restrained spotlight/hover treatment for a public evidence showcase.
4. Short, directional transitions for workflow progress or selected evidence states.

Use CSS/Motion/GSAP only when they add value. Respect `prefers-reduced-motion`. No cursor trails, scroll hijacking, particle backgrounds, endless loops, or animated dashboard cards.

## 13. Page coverage: preserve every existing route

Map and redesign the routes already declared in the source project. Preserve the existing route names unless the codebase requires a clear, documented change.

Public:
- `landing`, `platform`, `how`, `trust`, `faq`, `contact`, `legal`

Authentication:
- `login`, `register`, `verify-email`, `access-pending`, `forgot`, `reset`, `session-expired`

Claims/evidence:
- `dashboard`, `claims`, `new-claim`, `claim-detail`, `verification`, `documents`, `buyer-response`

Buyer:
- `inbox`, `response-history`

Lender:
- `review-queue`, `review`, `risk`, `decision`

Registry:
- `registry`, `registry-match`, `reservation`, `reservation-conflict`, `registry-history`

Audit/account/utilities:
- `audit`, `anchor`, `integrity`, `notifications`, `profile`, `security`, `help`, `search`, `states`, `access-denied`, `not-found`, `unavailable`

Each route must render a meaningful, designed state and be reachable by a working prototype interaction. Shared components are encouraged; blank pages and disconnected mockups are not.

## 14. Responsive and accessibility requirements

Design desktop (1440 × 1000 and 1280 × 900), tablet (834 × 1194), and mobile (390 × 844 and 360 × 800).

- No horizontal page overflow on mobile.
- Tables adapt to stacked rows or controlled horizontal scrolling with clear labels.
- Side navigation becomes an accessible drawer.
- Evidence comparison becomes a guided mobile workflow.
- Persistent form labels, visible focus, keyboard-operable controls, clear errors, and appropriate dialog focus behavior.
- Touch targets approximately 44 px where practical.
- Status never depends on color alone.
- Honor reduced-motion settings and maintain contrast.

## 15. Clickable prototype flows

Wire these flows:
1. Landing → registration → all steps → review → submitted/pending state.
2. Login → correct role dashboard → logout.
3. Seller → new claim → documents → extracted fields → submit → claim detail.
4. Claim detail → evidence comparison → mismatch detail → back to claim.
5. Buyer inbox → claim → confirm/dispute/request correction → reason → confirmation → history.
6. Lender queue → review → separate risk panels → registry check → reserve → decision → audit.
7. Registry search → match detail → reservation conflict → safe next action.
8. Audit → event detail → fingerprint → anchor status → integrity result.
9. Notification → related claim/event.
10. Profile/security/help/search and all error/system states → sensible next action.

Include loading, empty, validation, upload error, mismatch, missing evidence, buyer dispute, reservation conflict, anchor failure, permission denied, session expired, and unavailable states.

## 16. Required output and review checklist

Deliver:
- A clear art-direction page explaining the visual concept and reference observations.
- A foundations page with editable variables and typography.
- A reusable component library with meaningful variants.
- Redesigned screens for every route listed above.
- Responsive variants for major workflows.
- A connected clickable prototype.
- A route coverage checklist mapping the current app to new screens.
- A short handoff explaining which actions are prototype-only and which real integrations are still missing.

Before completion, verify:
- The product is visually distinctive without gradients or decorative effects.
- Typography is decisively changed from the generic default.
- Public pages, auth pages, evidence review, registry conflict, and audit ledger have different, task-appropriate compositions.
- Every existing route is covered and reachable.
- No fake customer logos, fake production metrics, or unsupported integrations have been added.
- All main CTAs work in the prototype.
- Demo data is labelled.
- Seller, buyer, and lender permissions remain distinct.
- Hashes are not presented as proof of document truth.
- Mobile layouts are deliberate, not simply compressed.
- Reduced-motion and accessibility states are considered.

**Final instruction:** Make MeiProof feel like a real, premium product designed by a strong product-design team. Use the reference images to guide taste and composition, but rebuild every screen as editable UI. Preserve the existing app's scope; improve its visual quality, clarity, and interaction design rather than reducing it to a beautiful landing page.
