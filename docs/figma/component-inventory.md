# Component inventory

Components found in `src/App.tsx`. These are React components in the current app, not a Figma library or Code Connect integration.

## Shared interface

- `Brand` — wordmark paired with the supplied logo asset.
- `Icon` — inline SVG icon set.
- `Button`, `Badge`, `Field`, `SelectField` — basic interface and form primitives.
- `Modal` — confirmation dialog with keyboard focus behavior.
- `PageHeader` — operational page heading and optional actions.
- `Shell` — role-labelled demo workspace navigation and top bar.

## Screen and workflow components

- Public/auth: `Public`, `PublicDetail`, `Auth`, `AuthAside`.
- Workspace: `Page`, `Dashboard`, `ClaimList`, `ClaimsTable`, `NewClaim`, `ClaimDetail`.
- Evidence and responses: `EvidencePage`, `BuyerActions`.
- Registry/audit: `Registry`, `Timeline`, `Audit`, `History`.
- Utilities: `Utility`, `SearchPage`, `SettingsPage`, `StateShowcase`.

The app is still concentrated in one source file; this inventory does not imply the requested page-module extraction has been completed.
