# Implemented design tokens

These values were read from `src/index.css`. They describe the current implementation, not a new design proposal.

## Colour

| CSS token | Value | Use |
| --- | --- | --- |
| `--ink` | `#0b0f0e` | Primary text and dark workspace surfaces |
| `--indigo` | `#2e713e` | Legacy token name; implemented as deep green |
| `--indigo-dark` | `#225a31` | Deep green hover state |
| `--lavender` | `#e4eadc` | Sage tinted surface |
| `--sand` | `#d4c0a0` | Warm accent |
| `--bg` | `#f7f6f2` | Paper background |
| `--surface` | `#ffffff` | White surface |
| `--border` | `#d9dad4` | Rules and borders |
| `--muted` | `#737873` | Secondary text |
| `--success` / `--success-bg` | `#2e713e` / `#e5ede0` | Positive states |
| `--warning` / `--warning-bg` | `#94671f` / `#f7ecd8` | Caution and pending states |
| `--danger` / `--danger-bg` | `#c53f3f` / `#fbe7e5` | Conflict and error states |
| `--info` / `--info-bg` | `#355f50` / `#e4ebe7` | Informational states |

## Typography

- Display: Fraunces, loaded from Google Fonts.
- UI/body: Inter, loaded from Google Fonts.
- Identifiers: IBM Plex Mono, loaded from Google Fonts.
- Browser fallback fonts remain enabled. The external font import requires network access; system fallbacks apply when it is unavailable.

## Motion and surfaces

The stylesheet includes a `prefers-reduced-motion` override. Surfaces use ink, paper, white, sage, and sand with restrained borders and small radii. No Figma variables or live design token sync are configured.
