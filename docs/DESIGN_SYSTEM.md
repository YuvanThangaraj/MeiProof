# MeiProof Design System — Source of Truth

## Concept
**Evidence, made tangible.** MeiProof should feel like a premium, precise financial evidence desk: editorial public storytelling paired with operationally clear document comparison, registry, risk, and audit interfaces.

## Fonts
- Display/headlines: Fraunces (or a close available editorial serif).
- UI/body/forms/tables: Inter or Satoshi-like sans serif.
- Hashes, invoice IDs, transaction refs, timestamps: IBM Plex Mono or another legible monospace.
- Use tabular numerals for amounts and metrics. Do not use the display serif throughout operational dashboards.

## Core palette
- Ink: `#0B0F0E`
- Charcoal: `#1A1C1F`
- Paper: `#F7F6F2`
- White: `#FFFFFF`
- Sage: `#A8BA90`
- Deep green: `#2E713E`
- Sand: `#D4C0A0`
- Amber: `#D7A65A`
- Red: `#D94A4A`
- Muted text: `#737873`
- Border: `#D9DAD4`

Use semantic color tokens; status must not depend on color alone. Green only means a specific check passed, amber means pending/caution, and red means dispute/hard conflict/integrity failure.

## Layout and components
- 8px spacing base; 12-column editorial grid on public pages.
- Mostly 6–12px radii; avoid universal pills and huge rounded cards.
- Prefer precise borders, tonal surfaces, alignment, and whitespace over heavy shadows.
- Public pages can use asymmetric editorial composition; auth pages are calm and focused; dashboards are task-oriented; evidence review uses document rail + preview + field-level comparison + decision rail; registry is data-dense; audit is a chronological ledger.
- Never repeat the same KPI-card grid on every page.

## References/toolkit
Motion.dev, Kokonut UI, React Bits, Manus, A1.gallery/Bevel, Land-book, Awwwards. Components may use shadcn/ui, Radix UI, 21st.dev patterns, Lucide icons, Tailwind CSS, and GSAP/Motion if justified. React Bits effects should be selective and must not become the design system.

## Motion
Maximum 3–4 signature patterns across the product: a subtle hero text reveal, a count-up for real/demo-labelled metrics, one restrained hover/spotlight on a public showcase, and short transitions for workflow state changes. Honor `prefers-reduced-motion`. No cursor trails, particles, scroll hijacking, perpetual loops, or animation that delays core actions.

## Avoid
Generic purple/blue gradients, glow blobs, gratuitous glassmorphism, repetitive bento layouts, interchangeable white cards, fake logos/metrics, fake “AI confidence” scores, decorative blockchain imagery, and unsupported claims.

## Reference images
See `docs/reference-images/`. These are inspiration boards, not assets to paste as page backgrounds. Rebuild content as editable UI. Remove unsupported stats/logos/integrations depicted in generated boards.
