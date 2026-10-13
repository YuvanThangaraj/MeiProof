# Implemented screen and route inventory

Routes are defined in `src/App.tsx`. `landing` uses `/`; each other route uses `/<route-slug>`. Unknown paths render the not-found state.

| Group | Routes | Implemented screen purpose |
| --- | --- | --- |
| Public | `landing`, `platform`, `how`, `trust`, `faq`, `contact`, `legal` | Product overview, workflow, limitations, FAQ, contact prototype, legal placeholders |
| Authentication | `login`, `register`, `verify-email`, `access-pending`, `forgot`, `reset`, `session-expired` | Local demo workspace selection, multi-step registration preview, and simulated auth states |
| Claims and evidence | `dashboard`, `claims`, `new-claim`, `claim-detail`, `verification`, `documents`, `buyer-response` | Role dashboard, synthetic claim list, local file selection, claim detail, evidence comparison, and buyer response preview |
| Buyer | `inbox`, `response-history` | Claim list and synthetic response history |
| Lender | `review-queue`, `review`, `risk`, `decision` | Review queue, evidence view, separate risk panels, decision preview |
| Registry | `registry`, `registry-match`, `reservation`, `reservation-conflict`, `registry-history` | Local synthetic search and labelled reservation outcome previews |
| Audit and utilities | `audit`, `anchor`, `integrity`, `notifications`, `profile`, `security`, `help`, `search`, `states`, `access-denied`, `not-found`, `unavailable` | Illustrative timeline/hash states, notification navigation, local profile preview, glossary, search, and system states |

All records and outcomes are synthetic or local previews. None of these screens are evidence of a connected backend service.
