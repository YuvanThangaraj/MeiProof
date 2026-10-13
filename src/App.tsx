import { useEffect, useMemo, useRef, useState } from "react"
import {
  demoModeAllowed,
  demoModeEnabled,
  demoAccountLoginEnabled,
  getMembershipRole,
  supabase,
  supabaseConfigurationError,
  supabaseConfigured,
} from "./lib/supabase"
import { backendApi, type ApiClaim, type ApiDocument, type ApiMembership, type ApiOrganization, type ApiVerification, backendBaseUrl } from "./lib/backend"

type Role = "seller" | "buyer" | "lender"
type Tone = "neutral" | "info" | "success" | "warning" | "danger"
type ClaimRecord = {
  id: string
  invoice: string
  seller: string
  buyer: string
  amount: string
  status: string
  tone: Tone
  registry: string
  integrity: string
  payment: string
  source: "demo" | "backend"
}
type Route = "landing" | "platform" | "how" | "trust" | "faq" | "contact" | "legal" | "login" | "register" | "verify-email" | "access-pending" | "forgot" | "reset" | "session-expired" | "dashboard" | "claims" | "new-claim" | "claim-detail" | "verification" | "documents" | "buyer-response" | "inbox" | "response-history" | "review-queue" | "review" | "risk" | "decision" | "registry" | "registry-match" | "reservation" | "reservation-conflict" | "registry-history" | "audit" | "anchor" | "integrity" | "notifications" | "profile" | "security" | "help" | "search" | "states" | "access-denied" | "not-found" | "unavailable"

const routePaths: Record<Route, string> = {
  landing: "/",
  platform: "/platform",
  how: "/how",
  trust: "/trust",
  faq: "/faq",
  contact: "/contact",
  legal: "/legal",
  login: "/login",
  register: "/register",
  "verify-email": "/verify-email",
  "access-pending": "/access-pending",
  forgot: "/forgot",
  reset: "/reset",
  "session-expired": "/session-expired",
  dashboard: "/dashboard",
  claims: "/claims",
  "new-claim": "/new-claim",
  "claim-detail": "/claim-detail",
  verification: "/verification",
  documents: "/documents",
  "buyer-response": "/buyer-response",
  inbox: "/inbox",
  "response-history": "/response-history",
  "review-queue": "/review-queue",
  review: "/review",
  risk: "/risk",
  decision: "/decision",
  registry: "/registry",
  "registry-match": "/registry-match",
  reservation: "/reservation",
  "reservation-conflict": "/reservation-conflict",
  "registry-history": "/registry-history",
  audit: "/audit",
  anchor: "/anchor",
  integrity: "/integrity",
  notifications: "/notifications",
  profile: "/profile",
  security: "/security",
  help: "/help",
  search: "/search",
  states: "/states",
  "access-denied": "/access-denied",
  "not-found": "/not-found",
  unavailable: "/unavailable",
}

const pathRoutes = new Map(
  Object.entries(routePaths).map(([route, path]) => [path, route as Route]),
)

function routeFromLocation(): Route {
  const path = window.location.pathname.replace(/\/+$/, "") || "/"
  return pathRoutes.get(path) ?? "not-found"
}

const claims: ClaimRecord[] = [
  {
    id: "CLM-2026-0042",
    invoice: "INV-2048",
    seller: "Aster Components Pvt Ltd",
    buyer: "Northstar Manufacturing Ltd",
    amount: "₹8,45,000",
    status: "Pending Buyer Confirmation",
    tone: "warning" as Tone,
    registry: "Not reserved",
    integrity: "Moderate",
    payment: "Low",
    source: "demo",
  },
  {
    id: "CLM-2026-0041",
    invoice: "INV-9137",
    seller: "Meridian Textiles Ltd",
    buyer: "Summit Retail Pvt Ltd",
    amount: "₹4,20,000",
    status: "Ready for Lender Review",
    tone: "success" as Tone,
    registry: "Available",
    integrity: "Low",
    payment: "Moderate",
    source: "demo",
  },
  {
    id: "CLM-2026-0038",
    invoice: "INV-7712",
    seller: "Kinetic Auto Parts LLP",
    buyer: "Northstar Manufacturing Ltd",
    amount: "₹12,80,000",
    status: "Duplicate Suspected",
    tone: "danger" as Tone,
    registry: "Potential match",
    integrity: "High",
    payment: "Low",
    source: "demo",
  },
  {
    id: "CLM-2026-0034",
    invoice: "INV-6014",
    seller: "Bluepeak Packaging",
    buyer: "Orion Foods Ltd",
    amount: "₹2,65,000",
    status: "Evidence Corroborated",
    tone: "success" as Tone,
    registry: "Reserved",
    integrity: "Low",
    payment: "Low",
    source: "demo",
  },
]

function apiClaimRecord(claim: ApiClaim): ClaimRecord {
  const status = claim.status.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
  const risk = (value: string | null) => value ? value.replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Not assessed"
  const tone: Tone = /disput|reject|investigat/i.test(status)
    ? "danger"
    : /pending|review|submitted|reserved/i.test(status)
      ? "warning"
      : "success"
  const numericAmount = Number(claim.amount)
  let formattedAmount = String(claim.amount)
  if (Number.isFinite(numericAmount)) {
    try {
      formattedAmount = new Intl.NumberFormat("en-IN", { style: "currency", currency: claim.currency, maximumFractionDigits: 0 }).format(numericAmount)
    } catch {
      formattedAmount = `${claim.currency} ${numericAmount.toLocaleString("en-IN")}`
    }
  }
  return {
    id: claim.id,
    invoice: claim.invoice_number,
    seller: claim.seller_organization_id ? `Seller · ${claim.seller_organization_id.slice(0, 8)}` : "Seller organization",
    buyer: claim.buyer_organization_id ? `Buyer · ${claim.buyer_organization_id.slice(0, 8)}` : "Buyer organization",
    amount: formattedAmount,
    status,
    tone: /high|critical/i.test(claim.integrity_risk_level ?? "") ? "danger" : tone,
    registry: "Not checked",
    integrity: risk(claim.integrity_risk_level),
    payment: risk(claim.payment_risk_level),
    source: "backend",
  }
}

const roleNav: Record<Role, [string, Route][]> = {
  seller: [
    ["Overview", "dashboard"],
    ["My claims", "claims"],
    ["New claim", "new-claim"],
    ["Verification", "verification"],
    ["Activity & audit", "audit"],
  ],
  buyer: [
    ["Overview", "dashboard"],
    ["Awaiting response", "inbox"],
    ["Responded claims", "response-history"],
    ["Activity", "audit"],
  ],
  lender: [
    ["Overview", "dashboard"],
    ["Review queue", "review-queue"],
    ["Financing registry", "registry"],
    ["Decision history", "decision"],
    ["Audit trail", "audit"],
  ],
}

function Icon({ name, size = 18 }: { name: string, size?: number }) {
  const p: Record<string, React.ReactNode> = {
    shield: (
      <>
        <path d="M12 3 5 6v5c0 4.5 3 8.5 7 10 4-1.5 7-5.5 7-10V6l-7-3Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 12h14" />
        <path d="m14 7 5 5-5 5" />
      </>
    ),
    home: (
      <>
        <path d="m3 11 9-8 9 8" />
        <path d="M5 10v11h14V10M9 21v-7h6v7" />
      </>
    ),
    file: (
      <>
        <path d="M6 2h8l4 4v16H6z" />
        <path d="M14 2v5h5M9 12h6M9 16h6" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    users: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20v-2a6 6 0 0 1 12 0v2M16 4a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5v1" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    alert: (
      <>
        <path d="M12 3 2 21h20L12 3Z" />
        <path d="M12 9v5M12 18h.01" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    link: (
      <>
        <path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" />
        <path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19 13.5v-3l2-1-2-4-2 1a8 8 0 0 0-2.5-1.5L14 3h-4l-.5 2A8 8 0 0 0 7 6.5l-2-1-2 4 2 1v3l-2 1 2 4 2-1A8 8 0 0 0 9.5 19l.5 2h4l.5-2a8 8 0 0 0 2.5-1.5l2 1 2-4-2-1Z" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
      </>
    ),
    upload: (
      <>
        <path d="M12 16V4m0 0L7 9m5-5 5 5" />
        <path d="M4 15v6h16v-6" />
      </>
    ),
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    logout: (
      <>
        <path d="M9 5H4v14h5M14 8l4 4-4 4M18 12H8" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
    dots: <path d="M5 12h.01M12 12h.01M19 12h.01" />,
  }
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {p[name] ?? p.file}
    </svg>
  )
}

function Brand({ light = false }: { light?: boolean }) {
  return (
    <div className={`brand ${light ? "light" : ""}`}>
      <span><img src="/assets/meiproof-logo.png" alt="MeiProof logo" /></span>
      <b>MeiProof</b>
    </div>
  )
}

function Button({
  children,
  onClick,
  variant = "primary",
  disabled = false,
  type = "button",
  title,
}: {
  children: React.ReactNode
  onClick?: React.MouseEventHandler<HTMLButtonElement>
  variant?: "primary" | "secondary" | "ghost" | "danger"
  disabled?: boolean
  type?: "button" | "submit"
  title?: string
}) {
  return (
    <button
      type={type}
      className={`btn ${variant}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  )
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode
  tone?: Tone
}) {
  return (
    <span className={`badge ${tone}`}>
      <span className="badge-dot" />
      {children}
    </span>
  )
}

function Field({
  label,
  placeholder,
  type = "text",
  error,
  defaultValue,
  value,
  onChange,
}: {
  label: string
  placeholder?: string
  type?: string
  error?: string
  defaultValue?: string
  value?: string
  onChange?: (value: string) => void
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type={type}
        placeholder={placeholder}
        defaultValue={value === undefined ? defaultValue : undefined}
        value={value}
        onChange={
          onChange ? (event) => onChange(event.target.value) : undefined
        }
      />
      {error && <small className="field-error">{error}</small>}
    </label>
  )
}

function SelectField({
  label,
  children,
  value,
  onChange,
}: {
  label: string
  children: React.ReactNode
  value?: string
  onChange?: (value: string) => void
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select
        value={value}
        onChange={
          onChange ? (event) => onChange(event.target.value) : undefined
        }
      >
        {children}
      </select>
    </label>
  )
}

function Modal({
  title,
  children,
  confirm,
  close,
  danger = false,
}: {
  title: string
  children: React.ReactNode
  confirm: () => void
  close: () => void
  danger?: boolean
}) {
  const dialog = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    const focusable = () =>
      dialog.current?.querySelectorAll<HTMLElement>(
        "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])",
      )
    const buttons = focusable()
    buttons?.[0]?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation()
        close()
      }
      if (event.key === "Tab") {
        const elements = focusable()
        if (!elements?.length) return
        if (event.shiftKey && document.activeElement === elements[0]) {
          event.preventDefault()
          elements[elements.length - 1]?.focus()
        } else if (
          !event.shiftKey &&
          document.activeElement === elements[elements.length - 1]
        ) {
          event.preventDefault()
          elements[0]?.focus()
        }
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      previousFocus?.focus()
    }
  }, [close])
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close()
      }}
    >
      <div
        ref={dialog}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className={`modal-icon ${danger ? "danger" : ""}`}>
          <Icon name={danger ? "alert" : "shield"} />
        </div>
        <h3 id="modal-title">{title}</h3>
        <p>{children}</p>
        <div className="modal-actions">
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={confirm}>
            Confirm action
          </Button>
        </div>
      </div>
    </div>
  )
}

function Public({ route, go }: { route: Route, go: (r: Route) => void }) {
  if (route !== "landing") return <PublicDetail route={route} go={go} />
  return (
    <div className="public">
      <header className="public-nav">
        <Brand />
        <nav>
          <button onClick={() => go("platform")}>Platform</button>
          <button onClick={() => go("how")}>How it works</button>
          <button onClick={() => go("trust")}>Trust & audit</button>
          <button onClick={() => go("faq")}>FAQ</button>
        </nav>
        <div>
          <Button variant="ghost" onClick={() => go("login")}>
            Sign in
          </Button>
          <Button onClick={() => go("register")}>Create account</Button>
        </div>
      </header>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <Badge tone="info">TRACE · VERIFY · FINANCE</Badge>
            <h1>Proof moves capital.</h1>
            <p>
              MeiProof helps sellers, buyers, and lenders review invoice
              evidence, identify inconsistencies, and keep an auditable record
              of important decisions.
            </p>
            <div className="hero-actions">
              <Button onClick={() => go("register")}>
                Get started <Icon name="arrow" />
              </Button>
              <Button variant="secondary" onClick={() => go("how")}>
                Explore the workflow
              </Button>
            </div>
            <small>
              <Icon name="lock" size={14} /> Private files · Transparent
              evidence · Human decisions
            </small>
          </div>
          <div className="product-preview">
            <div className="preview-top">
              <Brand />
              <Badge tone="info">Demo data</Badge>
            </div>
            <div className="invoice-head">
              <div>
                <small>CLAIM CLM-2026-0042</small>
                <h3>INV-2048</h3>
                <p>Aster Components Pvt Ltd</p>
              </div>
              <div>
                <small>INVOICE AMOUNT</small>
                <h3>₹8,45,000</h3>
                <Badge tone="warning">Pending confirmation</Badge>
              </div>
            </div>
            <div className="check-list">
              <b>Evidence checks</b>
              {[
                ["Seller & buyer identity", "Match", "success"],
                ["Invoice amount vs PO", "Match", "success"],
                ["Delivery quantity", "Review", "warning"],
                ["Normalized invoice identity", "No exact match", "success"],
              ].map((x) => (
                <div key={x[0]}>
                  <span>
                    <i className={x[2]}>
                      <Icon
                        name={x[2] === "warning" ? "search" : "check"}
                        size={13}
                      />
                    </i>
                    {x[0]}
                  </span>
                  <Badge tone={x[2] as Tone}>{x[1]}</Badge>
                </div>
              ))}
            </div>
            <div className="preview-foot">
              <span>
                <Icon name="link" size={15} /> Manifest hash recorded
              </span>
              <code>0x7a9f...c42e</code>
            </div>
          </div>
        </section>
        <section className="proof-strip">
          {[
            ["file", "Cross-document checks"],
            ["search", "Duplicate-claim signals"],
            ["users", "Buyer confirmation"],
            ["link", "Tamper-evident history"],
          ].map((x) => (
            <div key={x[1]}>
              <Icon name={x[0]} />
              <b>{x[1]}</b>
            </div>
          ))}
        </section>
        <section className="marketing-section">
          <div className="section-head">
            <span>ONE CONNECTED WORKFLOW</span>
            <h2>Evidence in. Uncertainty surfaced.</h2>
            <p>
              MeiProof keeps each source, finding, limitation, and next action
              visible.
            </p>
          </div>
          <div className="steps">
            {[
              [
                "01",
                "Collect evidence",
                "Upload the invoice, purchase order, delivery proof, and contract to private storage.",
              ],
              [
                "02",
                "Check and corroborate",
                "Compare fields, identify gaps, search the participating registry, and request a buyer response.",
              ],
              [
                "03",
                "Review with context",
                "Assess transaction integrity separately from payment risk before a human decision.",
              ],
            ].map((x) => (
              <article key={x[0]}>
                <i>{x[0]}</i>
                <h3>{x[1]}</h3>
                <p>{x[2]}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="dark-panel">
          <div>
            <span>TRANSPARENT BY DESIGN</span>
            <h2>
              Clear evidence.
              <br />
              Clear limitations.
            </h2>
            <p>
              Matching documents show consistency, not proof that a transaction
              occurred. Registry coverage is limited to participating demo
              institutions. Hashes verify recorded integrity, not original
              truth.
            </p>
            <Button variant="secondary" onClick={() => go("trust")}>
              Read our trust model
            </Button>
          </div>
          <div className="audit-preview">
            {[
              "Claim submitted",
              "Evidence checks completed",
              "Buyer response pending",
              "Demo manifest anchored",
            ].map((x, i) => (
              <div key={x}>
                <i>
                  <Icon name={i === 3 ? "link" : "check"} size={13} />
                </i>
                <span>
                  <b>{x}</b>
                  <small>
                    {i === 3
                      ? "Testnet · Demo reference"
                      : "Recorded in audit history"}
                  </small>
                </span>
                <time>10:{42 + i * 2}</time>
              </div>
            ))}
          </div>
        </section>
        <section className="cta-panel">
          <div>
            <span>SELLERS · BUYERS · LENDERS</span>
            <h2>Make evidence easier to review.</h2>
            <p>Start a transparent, role-aware invoice workflow.</p>
          </div>
          <Button variant="secondary" onClick={() => go("register")}>
            Get started <Icon name="arrow" />
          </Button>
        </section>
      </main>
      <footer>
        <Brand />
        <p>
          Evidence-based invoice review. Demo prototype with synthetic data.
        </p>
        <button onClick={() => go("legal")}>Privacy & terms placeholder</button>
      </footer>
    </div>
  )
}

function PublicDetail({ route, go }: { route: Route, go: (r: Route) => void }) {
  const data: Partial<Record<Route, [string, string, string[]]>> = {
    platform: [
      "The evidence layer for invoice review.",
      "Connect private documents, deterministic checks, independent buyer responses, separate risk indicators, a participating-lender registry, and tamper-evident audit records.",
      [
        "Cross-document field comparison",
        "Normalized duplicate candidates",
        "Independent buyer workflow",
        "Separate integrity and payment risk",
        "Human-controlled lender review",
      ],
    ],
    how: [
      "A workflow built around what remains uncertain.",
      "Sellers submit evidence, MeiProof checks consistency, buyers respond independently, and lenders review every signal before recording a decision.",
      [
        "Seller creates and submits a claim",
        "Evidence checks identify matches and gaps",
        "Buyer confirms, disputes, or requests correction",
        "Registry surfaces participating-lender matches",
        "Lender records a human decision",
      ],
    ],
    trust: [
      "Integrity is not the same as truth.",
      "MeiProof is explicit about the limits of documents, registries, hashes, and risk indicators.",
      [
        "Original documents remain off-chain and private",
        "Hashes detect changes to recorded versions",
        "Registry coverage is limited to participants",
        "Synthetic payment history is not a credit score",
        "MeiProof does not approve or disburse funds",
      ],
    ],
    faq: [
      "Questions, answered plainly.",
      "Scope, access, data handling, registry coverage, and audit terminology without inflated claims.",
      [
        "Do document matches prove genuineness? No.",
        "Can every financing event be found? No—only participating registry data.",
        "Are invoices stored on-chain? No.",
        "Is buyer confirmation a payment guarantee? No.",
        "Who decides whether to finance? The lender.",
      ],
    ],
    contact: [
      "Request demo access.",
      "This form is a prototype and does not connect to a live support system.",
      [
        "Tell us your organization",
        "Choose your intended role",
        "A privileged role still requires approval",
      ],
    ],
    legal: [
      "Prototype legal placeholders.",
      "No final privacy policy or terms were supplied. These sections are intentionally marked for legal review.",
      [
        "Privacy notice — content pending",
        "Terms of use — content pending",
        "Data retention policy — content pending",
      ],
    ],
  }
  const [title, intro, points] = data[route] ?? data.platform!
  return (
    <div className="public detail-page">
      <header className="public-nav">
        <button onClick={() => go("landing")}>
          <Brand />
        </button>
        <nav>
          <button onClick={() => go("platform")}>Platform</button>
          <button onClick={() => go("how")}>How it works</button>
          <button onClick={() => go("trust")}>Trust & audit</button>
        </nav>
        <Button onClick={() => go("login")}>Sign in</Button>
      </header>
      <main>
        <Button variant="ghost" onClick={() => go("landing")}>
          ← Back to home
        </Button>
        <Badge tone="info">MeiProof overview</Badge>
        <h1>{title}</h1>
        <p>{intro}</p>
        <div className="public-points">
          {points.map((p, i) => (
            <article key={p}>
              <i>0{i + 1}</i>
              <h3>{p}</h3>
              <p>
                {route === "trust"
                  ? "Visible limitations help reviewers understand what the evidence can support."
                  : "Designed as a practical, auditable step in the review workflow."}
              </p>
            </article>
          ))}
        </div>
        {route === "contact" && (
          <div className="contact-form">
            <Field label="Work email" placeholder="you@company.com" />
            <Field label="Organization" placeholder="Organization name" />
            <SelectField label="Intended role">
              <option>Seller</option>
              <option>Buyer</option>
              <option>Lender — approval required</option>
            </SelectField>
            <Button onClick={() => go("access-pending")}>Submit request</Button>
          </div>
        )}
      </main>
    </div>
  )
}

function Auth({
  route,
  go,
  setRole,
  onDemoLogin,
  statusMessage,
}: {
  route: Route
  go: (r: Route) => void
  setRole: (r: Role) => void
  onDemoLogin: (r: Role) => void
  statusMessage?: string
}) {
  const [step, setStep] = useState(1)
  const [authState, setAuthState] = useState<"default" | "loading" | "error">(
    "default",
  )
  const [selectedRole, setSelectedRole] = useState<Role>("seller")
  const [useDemoLogin, setUseDemoLogin] = useState(demoModeEnabled)
  const [registration, setRegistration] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    organization: "",
    organizationType: "Seller / Supplier",
    country: "India",
    businessId: "",
    website: "",
    phone: "",
  })
  const [termsAccepted, setTermsAccepted] = useState(true)
  const [formMessage, setFormMessage] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [resetPassword, setResetPassword] = useState("")
  const [confirmResetPassword, setConfirmResetPassword] = useState("")
  const loginAsDaniel = async () => {
    if (!supabase) {
      setAuthState("error")
      setFormMessage("Connect Supabase before using Daniel’s demo account.")
      return
    }
    setAuthState("loading")
    setFormMessage("")
    try {
      const tokens = await backendApi.demoLogin()
      const { data, error } = await supabase.auth.setSession(tokens)
      if (error || !data.user) throw error ?? new Error("Supabase did not return a user.")
      const assignedRole = await getMembershipRole(data.user.id)
      if (assignedRole) {
        setRole(assignedRole)
        go("dashboard")
      } else {
        go("access-pending")
      }
    } catch (error) {
      setAuthState("error")
      setFormMessage(error instanceof Error ? error.message : "Daniel’s demo sign-in failed.")
    }
  }
  const login = async () => {
    setAuthState("loading")
    setFormMessage("")
    if (useDemoLogin && demoModeAllowed) {
      window.setTimeout(() => {
        onDemoLogin(selectedRole)
        go("dashboard")
      }, 250)
      return
    }
    if (supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error || !data.user) {
        setAuthState("error")
        setFormMessage(error?.message ?? "Supabase did not return a user.")
        return
      }
      try {
        const assignedRole = await getMembershipRole(data.user.id)
        if (assignedRole) {
          setRole(assignedRole)
          go("dashboard")
        } else {
          go("access-pending")
        }
      } catch (membershipError) {
        setAuthState("error")
        setFormMessage(membershipError instanceof Error ? membershipError.message : "Workspace access could not be checked.")
      }
      return
    }
    setAuthState("error")
    setFormMessage("Supabase is not configured. Enable demo mode to open a local workspace.")
  }
  const submitRegistration = async () => {
    if (!supabase) {
      go("access-pending")
      return
    }
    setAuthState("loading")
    setFormMessage("")
    const { error } = await supabase.auth.signUp({
      email: registration.email,
      password: registration.password,
      options: { data: {
        display_name: registration.name,
        requested_role: selectedRole,
        organization_name: registration.organization,
        country: registration.country,
        business_identifier: registration.businessId,
        website: registration.website,
        phone: registration.phone,
      } },
    })
    if (error) {
      setAuthState("error")
      setFormMessage(error.message)
      return
    }
    setAuthState("default")
    go("verify-email")
  }
  const submitPasswordReset = async () => {
    if (!supabase) {
      setFormMessage("Reset request previewed locally. No email was sent.")
      return
    }
    setAuthState("loading")
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset`,
    })
    setAuthState(error ? "error" : "default")
    setFormMessage(error ? error.message : "Supabase accepted the request. Email delivery depends on project Auth settings.")
  }
  const submitPasswordUpdate = async () => {
    if (resetPassword.length < 8 || resetPassword !== confirmResetPassword) {
      setAuthState("error")
      setFormMessage("Use at least 8 characters and make both passwords match.")
      return
    }
    if (!supabase) {
      setFormMessage("Password update previewed locally. No password was changed.")
      return
    }
    setAuthState("loading")
    const { error } = await supabase.auth.updateUser({ password: resetPassword })
    setAuthState(error ? "error" : "default")
    setFormMessage(error ? error.message : "Supabase updated the password for this session.")
  }
  const updateRegistration = (key: keyof typeof registration, value: string) =>
    setRegistration((current) => ({ ...current, [key]: value }))
  if (route === "register")
    return (
      <div className="auth-page">
        <AuthAside />
        <div className="auth-main">
          <button
            className="back-link"
            onClick={() => (step > 1 ? setStep(step - 1) : go("landing"))}
          >
            ← Back
          </button>
          <div className="auth-card wide">
            <Brand />
            <div className="stepper">
              {[1, 2, 3, 4].map((x) => (
                <span className={x <= step ? "active" : ""} key={x}>
                  {x}
                </span>
              ))}
            </div>
            <small>STEP {step} OF 4</small>
            <h1>
              {
                [
                  "Create your account",
                  "Organization details",
                  "Request workspace access",
                  "Review your request",
                ][step - 1]
              }
            </h1>
            <p>
              {supabaseConfigured
                ? step === 3
                  ? "This submits a reviewable access request. Choosing a role never grants membership or permissions."
                  : "Create a Supabase account and request organization access. An administrator must approve membership separately."
                : step === 3
                  ? "Choosing a role requests access. It does not grant permissions; privileged access is validated server-side."
                  : "Use work details for this demo registration flow."}
            </p>
            {step === 1 && (
              <div className="form-grid">
                <Field
                  label="Full name"
                  placeholder="Your full name"
                  value={registration.name}
                  onChange={(v) => updateRegistration("name", v)}
                />
                <Field
                  label="Work email"
                  type="email"
                  placeholder="you@company.com"
                  value={registration.email}
                  onChange={(v) => updateRegistration("email", v)}
                />
                <Field
                  label="Password"
                  type="password"
                  placeholder="At least 8 characters"
                  value={registration.password}
                  onChange={(v) => updateRegistration("password", v)}
                />
                <Field
                  label="Confirm password"
                  type="password"
                  placeholder="Repeat password"
                  value={registration.confirmPassword}
                  onChange={(v) => updateRegistration("confirmPassword", v)}
                />
              </div>
            )}
            {step === 2 && (
              <div className="form-grid">
                <Field
                  label="Organization / legal name"
                  placeholder="Organization name"
                  value={registration.organization}
                  onChange={(v) => updateRegistration("organization", v)}
                />
                <SelectField
                  label="Organization type"
                  value={registration.organizationType}
                  onChange={(v) => updateRegistration("organizationType", v)}
                >
                  <option>Seller / Supplier</option>
                  <option>Buyer</option>
                  <option>Financing institution</option>
                </SelectField>
                <SelectField
                  label="Country / region"
                  value={registration.country}
                  onChange={(v) => updateRegistration("country", v)}
                >
                  <option>India</option>
                  <option>Singapore</option>
                  <option>Other</option>
                </SelectField>
                <Field
                  label="Business identifier (optional)"
                  placeholder="GSTIN or local identifier"
                  value={registration.businessId}
                  onChange={(v) => updateRegistration("businessId", v)}
                />
                <Field
                  label="Website (optional)"
                  placeholder="https://"
                  value={registration.website}
                  onChange={(v) => updateRegistration("website", v)}
                />
                <Field
                  label="Phone (optional)"
                  placeholder="+91"
                  value={registration.phone}
                  onChange={(v) => updateRegistration("phone", v)}
                />
              </div>
            )}
            {step === 3 && (
              <div className="role-cards">
                {(["seller", "buyer", "lender"] as Role[]).map((r) => (
                  <button
                    type="button"
                    aria-pressed={selectedRole === r}
                    className={selectedRole === r ? "selected" : ""}
                    onClick={() => setSelectedRole(r)}
                    key={r}
                  >
                    <Icon
                      name={
                        r === "seller"
                          ? "file"
                          : r === "buyer"
                            ? "users"
                            : "shield"
                      }
                    />
                    <b>{r[0].toUpperCase() + r.slice(1)}</b>
                    <span>
                      {r === "seller"
                        ? "Submit and track invoice claims."
                        : r === "buyer"
                          ? "Respond to claims for your organization."
                          : "Review evidence and registry results. Admin approval required."}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {step === 4 && (
              <div className="review-box">
                <div>
                  <span>Account</span>
                  <b>
                    {registration.name || "Not provided"} ·{" "}
                    {registration.email || "Not provided"}
                  </b>
                </div>
                <div>
                  <span>Organization</span>
                  <b>
                    {registration.organization || "Not provided"} ·{" "}
                    {registration.organizationType} · {registration.country}
                  </b>
                </div>
                <div>
                  <span>Business details</span>
                  <b>
                    {[
                      registration.businessId,
                      registration.website,
                      registration.phone,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "No optional details provided"}
                  </b>
                </div>
                <div>
                  <span>Requested workspace</span>
                  <b>
                    {selectedRole[0].toUpperCase() + selectedRole.slice(1)}{" "}
                    {selectedRole !== "seller" && "· Review required"}
                  </b>
                </div>
                <label>
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(event) => setTermsAccepted(event.target.checked)}
                  />{" "}
                  I acknowledge this is a prototype and legal terms are pending
                  review.
                </label>
              </div>
            )}
            {formMessage && (
              <div className="alert warning" role="status">
                <Icon name="alert" />
                {formMessage}
              </div>
            )}
            <div className="auth-actions">
              <Button variant="secondary" onClick={() => go("login")}>
                Already registered? Sign in
              </Button>
              <Button
                disabled={(step === 4 && !termsAccepted) || authState === "loading"}
                onClick={async () => {
                  if (
                    step === 1 &&
                    (!registration.name ||
                      !registration.email ||
                      registration.password.length < 8 ||
                      registration.password !== registration.confirmPassword)
                  ) {
                    setFormMessage(
                      "Enter your name and email, use a password with at least 8 characters, and make both passwords match.",
                    )
                    return
                  }
                  if (step === 2 && !registration.organization) {
                    setFormMessage("Enter your organization name to continue.")
                    return
                  }
                  if (step < 4) {
                    setFormMessage("")
                    setStep(step + 1)
                  } else if (supabase) await submitRegistration()
                  else go("access-pending")
                }}
              >
                {step < 4
                  ? "Continue"
                  : supabaseConfigured
                    ? authState === "loading"
                      ? "Creating account…"
                      : "Create account and request access"
                    : "Submit demo request"}{" "}
                <Icon name="arrow" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  if (
    [
      "verify-email",
      "access-pending",
      "forgot",
      "reset",
      "session-expired",
    ].includes(route)
  ) {
    if (route === "forgot" || route === "reset")
      return (
        <div className="auth-page">
          <AuthAside />
          <div className="auth-main">
            <div className="auth-card">
              <Brand />
              <small>{supabaseConfigured ? "SUPABASE AUTH" : "DEMO ONLY"}</small>
              <h1>
                {route === "forgot"
                  ? supabaseConfigured ? "Reset your password" : "Preview password reset"
                  : supabaseConfigured ? "Choose a new password" : "Preview password update"}
              </h1>
              <p>
                {supabaseConfigured
                  ? route === "forgot"
                    ? "Request a reset through Supabase. Email delivery depends on your project configuration."
                    : "Choose a replacement password for the active Supabase recovery session."
                  : "No authentication service is connected. Submitting this form does not send an email or change a password."}
              </p>
              {route === "forgot" ? (
                <Field
                  label="Work email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={setEmail}
                />
              ) : (
                <>
                  <Field label="New password" type="password" value={resetPassword} onChange={setResetPassword} />
                  <Field label="Confirm new password" type="password" value={confirmResetPassword} onChange={setConfirmResetPassword} />
                </>
              )}
              <Button
                disabled={authState === "loading"}
                onClick={route === "forgot" ? submitPasswordReset : submitPasswordUpdate}
              >
                {route === "forgot"
                  ? supabaseConfigured ? "Send reset request" : "Preview reset request"
                  : supabaseConfigured ? "Update password" : "Preview password update"}
              </Button>
              {formMessage && (
                <div className="alert info" role="status">
                  <Icon name="alert" />
                  {formMessage}
                </div>
              )}
              <Button variant="ghost" onClick={() => go("login")}>
                Return to sign in
              </Button>
            </div>
          </div>
        </div>
      )
    const content: Record<string, [string, string, string]> = {
      "verify-email": [
        "Demo registration received",
        supabaseConfigured
          ? "Supabase accepted the sign-up. Check your inbox if email verification is enabled; organization membership still requires administrator approval."
          : "Email verification is not connected. This screen is a local prototype state; no email was sent.",
        "Continue to sign in",
      ],
      "access-pending": [
        "Demo request preview",
        supabaseConfigured
          ? "This account has no approved organization membership yet. Requested roles never grant access by themselves; contact a MeiProof administrator."
          : "This screen previews an access-request outcome. No account was created and no organization review was submitted.",
        "Return to sign in",
      ],
      forgot: [
        "Password reset preview",
        "Password reset delivery is not connected. No email was sent.",
        "Return to sign in",
      ],
      reset: [
        "Password reset preview",
        "No password was changed because authentication is not connected.",
        "Continue to sign in",
      ],
      "session-expired": [
        "Your session ended",
        "For your security, sign in again to continue. Any locally saved draft data has been preserved where possible.",
        "Re-authenticate",
      ],
    }
    const c = content[route]
    return (
      <div className="auth-page">
        <AuthAside />
        <div className="auth-main">
          <div className="auth-card centered">
            <div className="success-icon">
              <Icon
                name={route === "session-expired" ? "clock" : "check"}
                size={28}
              />
            </div>
            <h1>
              {supabaseConfigured && route === "verify-email"
                ? "Account created"
                : supabaseConfigured && route === "access-pending"
                  ? "Workspace access pending"
                  : c[0]}
            </h1>
            <p>{statusMessage || c[1]}</p>
            <Button onClick={() => go("login")}>{c[2]}</Button>
            <Button variant="ghost" onClick={() => go("landing")}>
              Back to MeiProof
            </Button>
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="auth-page">
      <AuthAside />
      <div className="auth-main">
        <button className="back-link" onClick={() => go("landing")}>
          ← Back to home
        </button>
        <div className="auth-card">
          <Brand />
          <small>{useDemoLogin ? "DEMO WORKSPACE" : "SUPABASE AUTH"}</small>
          <h1>Welcome back</h1>
          <p>
            {useDemoLogin
              ? "Open a local demo workspace with synthetic data. No account is authenticated and no Supabase data is accessed."
              : "Sign in with your MeiProof account. Access depends on an approved organization membership."}
          </p>
          {authState === "error" && (
            <div className="alert danger">
              <Icon name="alert" />
              {formMessage || "Demo error preview. No credentials were checked."}
            </div>
          )}
          {demoModeAllowed && <label className="demo-login-toggle">
            <input
              type="checkbox"
              checked={useDemoLogin}
              disabled={!supabaseConfigured}
              onChange={(event) => setUseDemoLogin(event.target.checked)}
            />
            <span><b>Use demo login</b><small>{supabaseConfigured ? "Local synthetic data only; no account access" : "Demo login is the available sign-in mode"}</small></span>
          </label>}
          {useDemoLogin ? <SelectField
            label="Demo workspace"
            value={selectedRole}
            onChange={(v) => setSelectedRole(v as Role)}
          >
            <option value="seller">Seller — Aster Components</option>
            <option value="buyer">Buyer — Northstar Manufacturing</option>
            <option value="lender">Lender — Horizon Capital</option>
          </SelectField> : <>
            <Field
              label="Work email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={setEmail}
            />
            <Field
              label="Password"
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={setPassword}
            />
            <div className="form-meta">
              <label>
                <input type="checkbox" /> Keep me signed in
              </label>
              <button onClick={() => go("forgot")}>Forgot password?</button>
            </div>
          </>}
          {supabaseConfigurationError && <div className="alert danger" role="alert">{supabaseConfigurationError}</div>}
          <Button disabled={authState === "loading" || (useDemoLogin ? !demoModeAllowed : !supabaseConfigured)} onClick={login}>
            {authState === "loading"
              ? useDemoLogin ? "Opening demo workspace…" : "Signing in…"
              : useDemoLogin ? "Continue to demo workspace" : "Sign in"}{" "}
            <Icon name="arrow" />
          </Button>
          {demoAccountLoginEnabled && supabaseConfigured && !useDemoLogin && (
            <section className="demo-account-login" aria-label="Daniel demo account">
              <div>
                <small>PITCH DEMO · SELLER</small>
                <p>Use Daniel’s Supabase account with approved seller access. Records in the workspace are labelled demo.</p>
              </div>
              <Button variant="secondary" disabled={authState === "loading"} onClick={loginAsDaniel}>
                {authState === "loading" ? "Signing in as Daniel…" : "Continue as Daniel"}
                <Icon name="arrow" />
              </Button>
            </section>
          )}
          {useDemoLogin && demoModeAllowed && <Button variant="ghost" onClick={() => setAuthState("error")}>
            Preview error state
          </Button>}
          <p className="auth-switch">
            New to MeiProof?{" "}
            <button onClick={() => go("register")}>Create an account</button>
          </p>
        </div>
      </div>
    </div>
  )
}

function AuthAside() {
  return (
    <aside className="auth-aside">
      <Brand light />
      <div>
        <Badge tone="info">DEMO ENVIRONMENT</Badge>
        <h2>
          Evidence you can follow.
          <br />
          Decisions you can explain.
        </h2>
        <p>
          MeiProof connects documents, buyer responses, registry signals, risk
          context, and audit history without overstating what they prove.
        </p>
      </div>
      <small>Original files remain private and off-chain.</small>
    </aside>
  )
}

function Shell({
  role,
  demoAccountSession,
  route,
  go,
  logout,
  apiStatus,
  apiEnabled,
  apiError,
  liveClaims,
  selectedClaimId,
  memberships,
  refreshClaims,
  onReservationCreated,
  reservationId,
}: {
  role: Role
  demoAccountSession: boolean
  route: Route
  go: (r: Route, claimId?: string) => void
  logout: () => void
  apiStatus: "checking" | "online" | "offline"
  apiEnabled: boolean
  apiError: string
  liveClaims: ClaimRecord[]
  selectedClaimId: string | null
  memberships: ApiMembership[]
  refreshClaims: () => Promise<void>
  onReservationCreated: (id: string | null) => void
  reservationId: string | null
}) {
  const [mobile, setMobile] = useState(false)
  const title = route
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c: string) => c.toUpperCase())
  return (
    <div className="shell">
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <div className="sidebar-head">
          <Brand light />
          <button onClick={() => setMobile(false)}>
            <Icon name="close" />
          </button>
        </div>
        <div className="workspace">
          <small>WORKSPACE</small>
          <b>
            {demoAccountSession && role === "seller"
              ? "MeiProof Demo Seller"
              : role === "seller"
              ? "Aster Components"
              : role === "buyer"
                ? "Northstar Manufacturing"
                : "Horizon Capital"}
          </b>
          <span>
            {role[0].toUpperCase() + role.slice(1)} · Demo environment
          </span>
        </div>
        <nav>
          {roleNav[role].map(([label, r]) => (
            <button
              className={route === r ? "active" : ""}
              onClick={() => {
                go(r)
                setMobile(false)
              }}
              key={r}
            >
              <Icon
                name={
                  r === "dashboard"
                    ? "home"
                    : r.includes("audit")
                      ? "link"
                      : r.includes("registry")
                        ? "search"
                        : "file"
                }
              />
              {label}
            </button>
          ))}
        </nav>
        <div className="side-bottom">
          <button onClick={() => go("help")}>
            <Icon name="help" />
            Help & glossary
          </button>
          <button onClick={() => go("profile")}>
            <Icon name="settings" />
            Settings
          </button>
          <button onClick={logout}>
            <Icon name="logout" />
            Sign out
          </button>
        </div>
      </aside>
      <main className="app-main">
        <header className="topbar">
          <button
            className="mobile-menu"
            aria-label="Open navigation"
            onClick={() => setMobile(true)}
          >
            <Icon name="menu" />
          </button>
          <div>
            <small>MeiProof / {role} · {apiEnabled ? "Authenticated workspace" : "Demo workspace"}</small>
            <b>{title}</b>
          </div>
          <div className="top-actions">
            {apiEnabled ? <Badge tone={apiError ? "danger" : demoAccountSession ? "info" : "success"}>{apiError ? "API access error" : demoAccountSession ? "Daniel demo account · Supabase" : "Live API data"}</Badge> : <Badge tone="info">Demo data</Badge>}
            <span title={`FastAPI health check · ${backendBaseUrl}`}>
              <Badge tone={apiStatus === "online" ? "success" : apiStatus === "checking" ? "neutral" : "warning"}>
                {apiStatus === "checking" ? "API checking" : apiStatus === "online" ? "API online" : "API offline"}
              </Badge>
            </span>
            <button
              aria-label="Search demo records"
              onClick={() => go("search")}
            >
              <Icon name="search" />
            </button>
            <button
              aria-label="Notifications"
              onClick={() => go("notifications")}
            >
              <Icon name="bell" />
              <i />
            </button>
            <button
              aria-label="Profile"
              className="avatar"
              onClick={() => go("profile")}
            >
              DU
            </button>
          </div>
        </header>
        <div className="page">
          {apiError && apiEnabled && <div className="alert warning" role="status">Backend data could not be loaded: {apiError}</div>}
          <Page
            role={role}
            route={route}
            go={go}
            apiEnabled={apiEnabled}
            apiError={apiError}
            liveClaims={liveClaims}
            selectedClaimId={selectedClaimId}
            memberships={memberships}
            refreshClaims={refreshClaims}
            onReservationCreated={onReservationCreated}
            reservationId={reservationId}
          />
        </div>
      </main>
    </div>
  )
}

function Page({
  role,
  route,
  go,
  apiEnabled,
  apiError,
  liveClaims,
  selectedClaimId,
  memberships,
  refreshClaims,
  onReservationCreated,
  reservationId,
}: {
  role: Role
  route: Route
  go: (r: Route, claimId?: string) => void
  apiEnabled: boolean
  apiError: string
  liveClaims: ClaimRecord[]
  selectedClaimId: string | null
  memberships: ApiMembership[]
  refreshClaims: () => Promise<void>
  onReservationCreated: (id: string | null) => void
  reservationId: string | null
}) {
  if (route === "dashboard") return <Dashboard role={role} go={go} records={apiEnabled ? liveClaims : claims} live={apiEnabled} />
  if (["claims", "inbox", "review-queue"].includes(route))
    return <ClaimList role={role} go={go} records={apiEnabled ? liveClaims : claims} live={apiEnabled} />
  if (route === "new-claim") return apiEnabled
    ? <LiveNewClaim go={go} onCreated={refreshClaims} />
    : <NewClaim go={go} />
  if (["claim-detail", "review"].includes(route))
    return apiEnabled
      ? <LiveClaimDetail role={role} route={route} go={go} claimId={selectedClaimId} />
      : <ClaimDetail role={role} go={go} />
  if (["verification", "documents", "risk", "buyer-response"].includes(route))
    return apiEnabled
      ? <LiveEvidencePage route={route} role={role} go={go} claimId={selectedClaimId} refreshClaims={refreshClaims} />
      : <EvidencePage route={route} role={role} go={go} />
  if (
    [
      "registry",
      "registry-match",
      "reservation",
      "reservation-conflict",
      "registry-history",
    ].includes(route)
  )
    return apiEnabled
      ? <LiveRegistry route={route} go={go} claimId={selectedClaimId} memberships={memberships} onReservationCreated={onReservationCreated} reservationId={reservationId} records={liveClaims} />
      : <Registry route={route} go={go} />
  if (["audit", "anchor", "integrity"].includes(route))
    return <Audit route={route} go={go} />
  if (["decision", "response-history"].includes(route))
    return apiEnabled && role === "lender"
      ? <LiveLenderReview go={go} claimId={selectedClaimId} refreshClaims={refreshClaims} />
      : <History role={role} route={route} go={go} />
  if (
    [
      "profile",
      "security",
      "notifications",
      "help",
      "search",
      "states",
      "access-denied",
      "not-found",
      "unavailable",
    ].includes(route)
  )
    return <Utility route={route} role={role} go={go} />
  return <Utility route="not-found" role={role} go={go} />
}

function PageHeader({
  eyebrow,
  title,
  text,
  actions,
}: {
  eyebrow?: string
  title: string
  text: string
  actions?: React.ReactNode
}) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <span>{eyebrow}</span>}
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      {actions && <div>{actions}</div>}
    </div>
  )
}

function Dashboard({ role, go, records = claims, live = false }: { role: Role, go: (r: Route, claimId?: string) => void, records?: ClaimRecord[], live?: boolean }) {
  const metrics = live
    ? [
        [String(records.length), "Accessible claims"],
        [String(records.filter((claim) => /pending/i.test(claim.status)).length), "Awaiting response"],
        [String(records.filter((claim) => claim.tone === "danger" || claim.tone === "warning").length), "Need review"],
        [String(records.filter((claim) => /ready/i.test(claim.status)).length), "Ready for review"],
      ]
    :
    role === "seller"
      ? [
          ["12", "Claims submitted"],
          ["3", "Awaiting buyer"],
          ["2", "Need attention"],
          ["4", "Ready for review"],
        ]
      : role === "buyer"
        ? [
            ["5", "Awaiting response"],
            ["14", "Confirmed"],
            ["2", "Correction requested"],
            ["1", "Disputed"],
          ]
        : [
            ["18", "Awaiting review"],
            ["4", "Need investigation"],
            ["3", "Duplicate alerts"],
            ["₹24.8L", "Reserved exposure"],
          ]
  return (
    <>
      <PageHeader
        eyebrow={live ? "LIVE API · ACCESSIBLE RECORDS" : "DEMO DATA · SYNTHETIC RECORDS"}
        title={`Good morning, ${role === "lender" ? "Priya" : "Demo User"}.`}
        text={
          role === "seller"
            ? "Track evidence checks, buyer responses, and the next action for each claim."
            : role === "buyer"
              ? "Review only claims addressed to your organization and record an independent response."
              : "Prioritize review work with evidence-backed signals—not an opaque score."
        }
        actions={
          <Button
            onClick={() =>
              go(
                role === "seller"
                  ? "new-claim"
                  : role === "buyer"
                    ? "inbox"
                    : "review-queue",
              )
            }
          >
            {role === "seller"
              ? "Submit new claim"
              : role === "buyer"
                ? "Open inbox"
                : "Review queue"}{" "}
            <Icon name="arrow" />
          </Button>
        }
      />
      <div className="metrics">
        {metrics.map((m, i) => (
          <article key={m[1]}>
            <span className={`metric-icon m${i}`}>
              <Icon name={i === 2 ? "alert" : i === 1 ? "clock" : "file"} />
            </span>
            <div>
              <strong>{m[0]}</strong>
              <small>{m[1]}</small>
            </div>
          </article>
        ))}
      </div>
      <div className="panel">
        <div className="panel-head">
          <div>
            <h2>
              {role === "lender"
                ? "Priority review queue"
                : role === "buyer"
                  ? "Claims needing your response"
                  : "Recent claims"}
            </h2>
            <p>{live ? "Backend records · access scoped by organization membership" : "Demo data · Updated moments ago"}</p>
          </div>
          <Button
            variant="ghost"
            onClick={() =>
              go(
                role === "buyer"
                  ? "inbox"
                  : role === "lender"
                    ? "review-queue"
                    : "claims",
              )
            }
          >
            View all <Icon name="arrow" />
          </Button>
        </div>
        <ClaimsTable role={role} go={go} limit={3} records={records} />
      </div>
      <div className="dashboard-grid">
        <div className="panel">
          <h2>Recent activity</h2>
          {[
            "Verification checks completed for CLM-2026-0042",
            "Buyer response recorded for CLM-2026-0034",
            "Manifest hash queued for demo anchor",
          ].map((x, i) => (
            <div className="activity" key={x}>
              <i>
                <Icon name={i === 2 ? "link" : "check"} size={13} />
              </i>
              <span>
                <b>{x}</b>
                <small>{i + 1} hour ago · Demo preview · no event persisted</small>
              </span>
            </div>
          ))}
        </div>
        <div className="panel notice-panel">
          <Badge tone="info">PRODUCT LIMIT</Badge>
          <h2>Evidence supports review. It does not replace it.</h2>
          <p>
            Matching documents do not independently prove a transaction
            occurred. Financing remains a lender decision.
          </p>
          <button onClick={() => go("help")}>
            Read the evidence glossary →
          </button>
        </div>
      </div>
    </>
  )
}

function ClaimList({ role, go, records = claims, live = false }: { role: Role, go: (r: Route, claimId?: string) => void, records?: ClaimRecord[], live?: boolean }) {
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("All statuses")
  const [sort, setSort] = useState("Newest first")
  const matching = records.filter(
    (c) =>
      `${c.id} ${c.invoice} ${c.seller} ${c.buyer} ${c.amount} ${c.status}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (status === "All statuses" ||
        (status === "Needs attention" &&
          (c.tone === "warning" || c.tone === "danger")) ||
        (status === "Pending response" && c.status.includes("Pending"))),
  )
  const sorted =
    sort === "Highest amount"
      ? [...matching].sort(
          (a, b) =>
            Number(b.amount.replace(/[^\d]/g, "")) -
            Number(a.amount.replace(/[^\d]/g, "")),
        )
      : matching
  return (
    <>
      <PageHeader
        eyebrow={live ? "BACKEND RECORDS · AUTHENTICATED" : "DEMO DATA"}
        title={
          role === "seller"
            ? "My claims"
            : role === "buyer"
              ? "Claim inbox"
              : "Review queue"
        }
        text={
          role === "buyer"
            ? "Claims shown here are addressed to Northstar Manufacturing Ltd."
            : role === "lender"
              ? "Compare verification, buyer response, risk, and registry status before opening a review."
              : "Search and track every invoice claim submitted by your organization."
        }
        actions={
          role === "seller" ? (
            <Button onClick={() => go("new-claim")}>New claim</Button>
          ) : undefined
        }
      />
      <div className="panel filters">
        <div className="search-box">
          <Icon name="search" />
          <input
            aria-label="Search claims"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search claim, invoice, seller or buyer"
          />
        </div>
        <select
          aria-label="Filter claim status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option>All statuses</option>
          <option>Needs attention</option>
          <option>Pending response</option>
        </select>
        <select
          aria-label="Sort claims"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option>Newest first</option>
          <option>Highest amount</option>
        </select>
        <Button
          variant="ghost"
          onClick={() => {
            setQuery("")
            setStatus("All statuses")
            setSort("Newest first")
          }}
        >
          Clear filters
        </Button>
      </div>
      <div className="panel table-panel">
        {sorted.length ? (
          <ClaimsTable role={role} go={go} records={sorted} />
        ) : (
          <div className="panel empty">
            <b>{live ? "No accessible claims" : "No matching demo claims"}</b>
            <p>Try another search or clear the filters.</p>
          </div>
        )}
        <div className="pagination">
          <span>
            Showing {sorted.length} of {records.length} {live ? "backend records" : "demo records"}
          </span>
          <div>
            <Button variant="secondary" disabled>
              Previous
            </Button>
            <Button variant="secondary" disabled>
              Next
            </Button>
          </div>
        </div>
      </div>
      <StateShowcase compact />
    </>
  )
}

function ClaimsTable({
  role,
  go,
  limit,
  records = claims,
}: {
  role: Role
  go: (r: Route, claimId?: string) => void
  limit?: number
  records?: ClaimRecord[]
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Claim / Invoice</th>
            <th>{role === "buyer" ? "Seller" : "Buyer"}</th>
            <th>Amount</th>
            <th>Verification</th>
            {role === "lender" && (
              <>
                <th>Integrity / Payment</th>
                <th>Registry</th>
              </>
            )}
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {records.slice(0, limit).map((c) => (
            <tr
              key={c.id}
              onClick={() => go(role === "lender" ? "review" : "claim-detail", c.id)}
            >
              <td>
                <b>{c.id}</b>
                <small>{c.invoice}</small>
              </td>
              <td>
                <b>{role === "buyer" ? c.seller : c.buyer}</b>
                <small>{c.source === "backend" ? "Organization reference" : "Demo organization"}</small>
              </td>
              <td>
                <b>{c.amount}</b>
                <small>{c.source === "backend" ? "Backend amount" : "INR"}</small>
              </td>
              <td>
                <Badge tone={c.tone}>{c.status}</Badge>
              </td>
              {role === "lender" && (
                <>
                  <td>
                    <div className="dual-risk">
                      <Badge
                        tone={
                          c.integrity === "High"
                            ? "danger"
                            : c.integrity === "Moderate"
                              ? "warning"
                              : "success"
                        }
                      >
                        I: {c.integrity}
                      </Badge>
                      <Badge
                        tone={c.payment === "Moderate" ? "warning" : "success"}
                      >
                        P: {c.payment}
                      </Badge>
                    </div>
                  </td>
                  <td>
                    <Badge
                      tone={c.registry.includes("match") ? "danger" : "neutral"}
                    >
                      {c.registry}
                    </Badge>
                  </td>
                </>
              )}
              <td>
                <Button
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation()
                    go(role === "lender" ? "review" : "claim-detail", c.id)
                  }}
                >
                  {role === "buyer"
                    ? "Review claim"
                    : role === "lender"
                      ? "Open review"
                      : "View details"}{" "}
                  →
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function NewClaim({ go }: { go: (r: Route) => void }) {
  const [step, setStep] = useState(1)
  const [submitted, setSubmitted] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const fileInput = useRef<HTMLInputElement>(null)
  if (submitted)
    return (
      <div className="result-page">
        <div className="success-icon">
          <Icon name="check" size={30} />
        </div>
        <Badge tone="info">DEMO · CLM-2026-0045</Badge>
        <h1>Claim demo submitted</h1>
        <p>
          This local prototype state does not upload files or run extraction.
          Buyer confirmation and registry checks are not connected.
        </p>
        <div className="processing">
          <span />
          <div>
            <b>Local demo only</b>
            <small>No backend verification was started</small>
          </div>
        </div>
        <Button onClick={() => go("claim-detail")}>Open claim details</Button>
      </div>
    )
  return (
    <>
      <PageHeader
        eyebrow="SELLER WORKFLOW"
        title="Create invoice claim"
        text="Save a draft at any point. Original evidence and later corrections remain versioned in the audit history."
      />
      <div className="flow-stepper">
        {["Invoice details", "Upload evidence", "Review & submit"].map(
          (x, i) => (
            <div className={step >= i + 1 ? "active" : ""} key={x}>
              <span>
                {step > i + 1 ? <Icon name="check" size={14} /> : i + 1}
              </span>
              <b>{x}</b>
            </div>
          ),
        )}
      </div>
      <div className="form-layout">
        <div className="panel form-panel">
          {step === 1 && (
            <>
              <h2>Invoice details</h2>
              <p>Enter the values exactly as they appear on the invoice.</p>
              <div className="form-grid">
                <Field label="Invoice number" defaultValue="INV-2048" />
                <Field label="Invoice date" type="date" />
                <Field label="Due date" type="date" />
                <Field
                  label="Purchase order reference"
                  defaultValue="PO-7781"
                />
                <Field
                  label="Seller organization"
                  defaultValue="Aster Components Pvt Ltd"
                />
                <Field
                  label="Buyer organization"
                  defaultValue="Northstar Manufacturing Ltd"
                />
                <SelectField label="Currency">
                  <option>INR — Indian Rupee</option>
                  <option>USD — US Dollar</option>
                </SelectField>
                <Field label="Invoice total" defaultValue="845000" />
                <Field label="Subtotal" defaultValue="716102" />
                <Field label="Tax" defaultValue="128898" />
              </div>
              <Field
                label="Goods / service description"
                defaultValue="Precision components — delivery lot 4"
              />
            </>
          )}
          {step === 2 && (
            <>
              <h2>Supporting evidence</h2>
              <p>
                Choose local files to preview their names. This prototype does
                not upload, hash, or extract document contents.
              </p>
              <input
                ref={fileInput}
                className="visually-hidden"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                multiple
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              />
              <div className="upload-zone">
                <Icon name="upload" size={28} />
                <b>Choose documents from this device</b>
                <span>
                  PDF, PNG, JPG · Selected files stay in this browser session
                </span>
                <Button
                  variant="secondary"
                  onClick={() => fileInput.current?.click()}
                >
                  Browse files
                </Button>
              </div>
              {files.map((file) => (
                <div
                  className="file-row"
                  key={`${file.name}-${file.lastModified}`}
                >
                  <i>
                    <Icon name="file" />
                  </i>
                  <span>
                    <b>{file.name}</b>
                    <small>
                      {(file.size / 1024).toFixed(1)} KB · Local selection only
                    </small>
                  </span>
                  <Badge tone="info">Selected</Badge>
                  <button
                    aria-label={`Remove ${file.name}`}
                    onClick={() =>
                      setFiles((current) =>
                        current.filter((item) => item !== file),
                      )
                    }
                  >
                    <Icon name="close" />
                  </button>
                </div>
              ))}
              <div className="alert info">
                <Icon name="alert" />
                Selecting files does not verify or upload them. Delivery
                quantity checks are simulated.
              </div>
            </>
          )}
          {step === 3 && (
            <>
              <h2>Review before submission</h2>
              <p>
                This local action does not run extraction or reserve financing.
              </p>
              <div className="summary-grid">
                <div>
                  <span>Invoice</span>
                  <b>INV-2048 · ₹8,45,000</b>
                </div>
                <div>
                  <span>Buyer</span>
                  <b>Northstar Manufacturing Ltd</b>
                </div>
                <div>
                  <span>Evidence selected</span>
                  <b>
                    {files.length} local file{files.length === 1 ? "" : "s"} ·
                    not uploaded
                  </b>
                </div>
                <div>
                  <span>Buyer response</span>
                  <b>Not requested · demo</b>
                </div>
              </div>
              <div className="alert warning">
                <Icon name="search" />
                <span>
                  <b>Potential prior identity requires a registry check</b>This
                  is a candidate signal, not proof of duplicate financing.
                </span>
              </div>
              <label className="declaration">
                <input type="checkbox" /> I confirm I am authorized to submit
                this claim and understand that matching evidence is not proof
                the transaction occurred.
              </label>
            </>
          )}
          <div className="form-actions">
            <Button
              variant="secondary"
              onClick={() => (step > 1 ? setStep(step - 1) : go("dashboard"))}
            >
              {step > 1 ? "Back" : "Save draft"}
            </Button>
            <Button
              onClick={() =>
                step < 3 ? setStep(step + 1) : setSubmitted(true)
              }
            >
              {step < 3 ? "Continue" : "Submit claim"} <Icon name="arrow" />
            </Button>
          </div>
        </div>
        <aside className="panel tip-card">
          <Icon name="shield" />
          <h3>Evidence handling</h3>
          <p>
            Original files remain private and off-chain. Corrections create a
            new version; they never silently replace source evidence.
          </p>
          <hr />
          <small>Role boundary</small>
          <p>
            Sellers cannot confirm their own claims as buyers or record lender
            decisions.
          </p>
        </aside>
      </div>
    </>
  )
}

function ClaimDetail({ role, go }: { role: Role, go: (r: Route) => void }) {
  const tabs: [string, Route][] = [
    ["Overview", "claim-detail"],
    ["Documents & checks", "documents"],
    ["Risk detail", "risk"],
    ["Registry", "registry"],
    ["Audit trail", "audit"],
  ]
  return (
    <>
      <div className="claim-title">
        <div>
          <button
            onClick={() => go(role === "lender" ? "review-queue" : "claims")}
          >
            ← Back
          </button>
          <small>CLAIM CLM-2026-0042 · DEMO DATA</small>
          <h1>INV-2048</h1>
          <p>Aster Components Pvt Ltd → Northstar Manufacturing Ltd</p>
        </div>
        <div>
          <strong>₹8,45,000</strong>
          <Badge tone="warning">Pending Buyer Confirmation</Badge>
        </div>
      </div>
      <div className="tabs">
        {tabs.map(([x, r]) => (
          <button
            className={r === "claim-detail" ? "active" : ""}
            onClick={() => go(r)}
            key={r}
          >
            {x}
          </button>
        ))}
      </div>
      <div className="review-layout">
        <div>
          <div className="panel">
            <div className="panel-head">
              <div>
                <h2>Claim summary</h2>
                <p>Submitted 14 Mar 2026 · Due 30 Apr 2026</p>
              </div>
              <Button variant="secondary" onClick={() => go("documents")}>
                Compare documents
              </Button>
            </div>
            <div className="summary-grid four">
              <div>
                <span>Invoice number</span>
                <b>INV-2048</b>
              </div>
              <div>
                <span>PO reference</span>
                <b>PO-7781</b>
              </div>
              <div>
                <span>Currency</span>
                <b>INR</b>
              </div>
              <div>
                <span>Evidence</span>
                <b>3 of 4 files</b>
              </div>
            </div>
          </div>
          <div className="panel">
            <h2>Verification snapshot</h2>
            {[
              ["Document consistency", "3 matched · 1 needs review", "warning"],
              [
                "Buyer response",
                "Awaiting simulated buyer response",
                "warning",
              ],
              [
                "Duplicate checks",
                "No exact file match · 1 identity candidate",
                "info",
              ],
              [
                "File integrity",
                "Recorded hashes match current versions",
                "success",
              ],
            ].map((x) => (
              <div className="finding-row" key={x[0]}>
                <i className={x[2]}>
                  <Icon
                    name={
                      x[2] === "success"
                        ? "check"
                        : x[2] === "warning"
                          ? "alert"
                          : "search"
                    }
                  />
                </i>
                <span>
                  <b>{x[0]}</b>
                  <small>{x[1]}</small>
                </span>
                <Badge tone={x[2] as Tone}>
                  {x[2] === "success"
                    ? "Passed"
                    : x[2] === "warning"
                      ? "Review"
                      : "Candidate"}
                </Badge>
              </div>
            ))}
            <Button variant="ghost" onClick={() => go("verification")}>
              View all verification findings →
            </Button>
          </div>
        </div>
        <aside>
          <div className="panel risk-card">
            <h2>Transaction integrity</h2>
            <Badge tone="warning">Moderate review concern</Badge>
            <p>
              Delivery quantity differs and buyer confirmation is pending. No
              conclusion of fraud is made.
            </p>
            <button onClick={() => go("risk")}>
              View contributing factors →
            </button>
          </div>
          <div className="panel risk-card">
            <h2>Buyer payment risk</h2>
            <Badge tone="success">Low · Demo history</Badge>
            <p>
              Based on 18 synthetic invoices over 12 months. Not an external
              credit score.
            </p>
            <button onClick={() => go("risk")}>Review payment history →</button>
          </div>
          <div className="panel">
            <h2>Next action</h2>
            <p>
              {role === "lender"
                ? "Hold until buyer response or request more evidence."
                : "Await the buyer response and review the quantity mismatch."}
            </p>
            <Button
              onClick={() =>
                go(role === "lender" ? "decision" : "buyer-response")
              }
            >
              {role === "lender"
                ? "Record review action"
                : "View buyer response"}
            </Button>
          </div>
        </aside>
      </div>
    </>
  )
}

function EvidencePage({
  route,
  role,
  go,
}: {
  route: Route
  role: Role
  go: (r: Route, claimId?: string) => void
}) {
  const [selectedEvidence, setSelectedEvidence] = useState(0)
  const [zoom, setZoom] = useState(100)
  const [clarification, setClarification] = useState(false)
  if (route === "risk")
    return (
      <>
        <PageHeader
          eyebrow="CLM-2026-0042 · DEMO DATA"
          title="Explainable risk detail"
          text="Transaction integrity and buyer payment risk remain separate. Neither is a validated probability of fraud or default."
        />
        <div className="risk-columns">
          <div className="panel">
            <h2>Transaction integrity</h2>
            <Badge tone="warning">Moderate review concern</Badge>
            {[
              [
                "Delivery quantity mismatch",
                "Invoice: 1,200 · Receipt: 1,150",
                "Increases concern",
              ],
              [
                "Buyer confirmation pending",
                "No independent buyer response yet",
                "Increases concern",
              ],
              [
                "Exact file duplicate",
                "No hash match found",
                "Reduces concern",
              ],
              [
                "File integrity",
                "Current bytes match recorded hash",
                "Reduces concern",
              ],
            ].map((x) => (
              <div className="risk-factor" key={x[0]}>
                <span>
                  <b>{x[0]}</b>
                  <small>{x[1]}</small>
                </span>
                <Badge tone={x[2].startsWith("In") ? "warning" : "success"}>
                  {x[2]}
                </Badge>
              </div>
            ))}
          </div>
          <div className="panel">
            <h2>Buyer payment risk</h2>
            <Badge tone="success">Low · Synthetic history</Badge>
            <div className="payment-metrics">
              <div>
                <strong>83%</strong>
                <small>On-time rate</small>
              </div>
              <div>
                <strong>4 days</strong>
                <small>Average lateness</small>
              </div>
              <div>
                <strong>₹3.2L</strong>
                <small>Overdue receivables</small>
              </div>
              <div>
                <strong>18</strong>
                <small>Invoice sample</small>
              </div>
            </div>
            <div className="alert info">
              <Icon name="alert" />
              Based on supplied demo history through 14 Mar 2026. Not externally
              validated.
            </div>
          </div>
        </div>
      </>
    )
  if (route === "buyer-response")
    return (
      <>
        <PageHeader
          eyebrow="SIMULATED BUYER WORKFLOW"
          title={role === "buyer" ? "Respond to INV-2048" : "Buyer response"}
          text={
            role === "buyer"
              ? "Confirm the shown details, dispute the claim, or request a correction. Your response is recorded in the audit trail."
              : "The buyer has not yet responded to this claim."
          }
        />
        {role === "buyer" ? (
          <BuyerActions go={go} />
        ) : (
          <div className="empty panel">
            <i>
              <Icon name="clock" size={28} />
            </i>
            <h2>Awaiting buyer response</h2>
            <p>
              Matching seller-provided documents do not replace an independent
              buyer response.
            </p>
          </div>
        )}
      </>
    )
  const rows = [
    [
      "Seller name",
      "Aster Components Pvt Ltd",
      "Aster Components Pvt Ltd",
      "Match",
      "success",
    ],
    [
      "Buyer name",
      "Northstar Manufacturing Ltd",
      "Northstar Manufacturing Ltd",
      "Match",
      "success",
    ],
    ["Total amount", "₹8,45,000", "₹8,45,000", "Match", "success"],
    ["Quantity", "1,200 units", "1,150 units", "Mismatch", "danger"],
    ["PO reference", "PO-7781", "PO-7781", "Match", "success"],
    ["Contract", "Not supplied", "Not comparable", "Missing", "warning"],
  ]
  return (
    <>
      <PageHeader
        eyebrow="CLM-2026-0042 · VERIFICATION COMPLETED"
        title={
          route === "documents"
            ? "Evidence comparison"
            : "Verification findings"
        }
        text="Inspect the original source beside field-level findings. Consistency is not proof that the transaction occurred."
        actions={
          <Button variant="secondary" onClick={() => go("claim-detail")}>
            Back to claim
          </Button>
        }
      />
      <div className="evidence-workspace">
        <aside className="evidence-rail">
          <small>EVIDENCE SOURCES</small>
          {[
            ["Invoice", "INV-2048.pdf", "success"],
            ["Purchase order", "PO-7781.pdf", "success"],
            ["Delivery receipt", "delivery-lot-4.pdf", "warning"],
            ["Contract", "Not supplied", "neutral"],
          ].map((x, i) => (
            <button
              type="button"
              aria-pressed={selectedEvidence === i}
              className={selectedEvidence === i ? "active" : ""}
              key={x[0]}
              onClick={() => setSelectedEvidence(i)}
            >
              <i>
                <Icon name="file" size={16} />
              </i>
              <span>
                <b>{x[0]}</b>
                <small>{x[1]}</small>
              </span>
              <Badge tone={x[2] as Tone}>
                {x[2] === "success"
                  ? "Demo"
                  : x[2] === "warning"
                    ? "Review"
                    : "Missing"}
              </Badge>
            </button>
          ))}
        </aside>
        <section className="document-viewer">
          <div className="viewer-tools">
            <span>
              {
                [
                  "INV-2048.pdf",
                  "PO-7781.pdf",
                  "delivery-lot-4.pdf",
                  "Contract · not supplied",
                ][selectedEvidence]
              }{" "}
              · Demo preview
            </span>
            <div>
              <button
                aria-label="Zoom out"
                onClick={() => setZoom((value) => Math.max(60, value - 10))}
              >
                −
              </button>
              <b>{zoom}%</b>
              <button
                aria-label="Zoom in"
                onClick={() => setZoom((value) => Math.min(150, value + 10))}
              >
                +
              </button>
            </div>
          </div>
          <article className="invoice-sheet">
            <div className="sheet-mark">
              <Icon name="shield" size={14} /> MeiProof evidence copy
            </div>
            <h2>INVOICE</h2>
            <h3>Aster Components Pvt Ltd</h3>
            <div className="sheet-rule" />
            {[
              ["Invoice number", "INV-2048"],
              ["Invoice date", "14 Mar 2026"],
              ["Purchase order", "PO-7781"],
              ["Buyer", "Northstar Manufacturing Ltd"],
              ["Quantity", "1,200 units"],
              ["Amount", "₹8,45,000"],
            ].map((x) => (
              <div className="sheet-row" key={x[0]}>
                <span>{x[0]}</span>
                <b>{x[1]}</b>
              </div>
            ))}
            <div className="sheet-total">
              <span>TOTAL</span>
              <b>₹8,45,000</b>
            </div>
            <small>DEMO DOCUMENT · SYNTHETIC DATA</small>
          </article>
        </section>
        <section className="comparison-pane">
          <div className="comparison-head">
            <div>
              <small>FIELD-BY-FIELD REVIEW</small>
              <h2>Cross-document checks</h2>
            </div>
            <Badge tone="warning">1 mismatch</Badge>
          </div>
          <div className="alert warning">
            <Icon name="alert" />
            <span>
              <b>Delivery quantity needs review</b>The receipt records 50 fewer
              units. Request clarification before proceeding.
            </span>
          </div>
          <div className="comparison-rows">
            {rows.map((x) => (
              <div
                className={
                  x[3] === "Mismatch"
                    ? "comparison-row mismatch"
                    : "comparison-row"
                }
                key={x[0]}
              >
                <div>
                  <small>FIELD</small>
                  <b>{x[0]}</b>
                </div>
                <div>
                  <small>INVOICE</small>
                  <span>{x[1]}</span>
                </div>
                <div>
                  <small>SUPPORTING EVIDENCE</small>
                  <span>{x[2]}</span>
                </div>
                <Badge tone={x[4] as Tone}>{x[3]}</Badge>
              </div>
            ))}
          </div>
          <div className="comparison-note">
            <b>Why this matters</b>
            <p>
              A quantity difference may indicate partial delivery, a clerical
              error, or missing evidence. It is a review signal, not proof of
              fraud.
            </p>
            <Button variant="secondary" onClick={() => setClarification(true)}>
              Request clarification · demo
            </Button>
            {clarification && (
              <p role="status">
                Clarification request previewed locally. No message was sent to
                a buyer.
              </p>
            )}
          </div>
        </section>
      </div>
    </>
  )
}

function BuyerActions({ go }: { go: (r: Route) => void }) {
  const [action, setAction] = useState<"confirm" | "dispute" | "correct">(
    "confirm",
  )
  const [done, setDone] = useState(false)
  const [modal, setModal] = useState(false)
  if (done)
    return (
      <div className="result-page">
        <div className="success-icon">
          <Icon name="check" size={30} />
        </div>
        <h1>Response recorded</h1>
        <p>
          Your simulated buyer response and timestamp were added to the claim
          audit trail.
        </p>
        <Badge
          tone={
            action === "dispute"
              ? "danger"
              : action === "correct"
                ? "warning"
                : "success"
          }
        >
          {action === "confirm"
            ? "Details confirmed"
            : action === "dispute"
              ? "Claim disputed"
              : "Correction requested"}
        </Badge>
        <Button onClick={() => go("response-history")}>
          View response history
        </Button>
      </div>
    )
  return (
    <div className="response-layout">
      <div className="panel">
        <h2>Invoice summary</h2>
        <div className="summary-grid">
          <div>
            <span>Seller</span>
            <b>Aster Components Pvt Ltd</b>
          </div>
          <div>
            <span>Invoice</span>
            <b>INV-2048 · ₹8,45,000</b>
          </div>
          <div>
            <span>PO</span>
            <b>PO-7781</b>
          </div>
          <div>
            <span>Delivery</span>
            <b>Receipt quantity needs review</b>
          </div>
        </div>
        <div className="alert info">
          <Icon name="alert" />
          Your response confirms only the details shown. It is not a repayment
          guarantee or legal validation.
        </div>
      </div>
      <div className="panel">
        <div className="action-tabs">
          {(["confirm", "dispute", "correct"] as const).map((x) => (
            <button
              className={action === x ? "active" : ""}
              onClick={() => setAction(x)}
              key={x}
            >
              {x === "confirm"
                ? "Confirm details"
                : x === "dispute"
                  ? "Dispute claim"
                  : "Request correction"}
            </button>
          ))}
        </div>
        {action === "confirm" && (
          <>
            <h2>Confirm submitted details</h2>
            <label className="declaration">
              <input type="checkbox" /> I reviewed the invoice, PO reference,
              amount, and delivery details shown.
            </label>
          </>
        )}
        {action === "dispute" && (
          <>
            <SelectField label="Dispute reason">
              <option>Delivery quantity mismatch</option>
              <option>Goods/services not received</option>
              <option>Invoice not recognized</option>
              <option>Wrong entity</option>
            </SelectField>
            <label className="field">
              <span>Required explanation</span>
              <textarea placeholder="Explain what does not match" />
            </label>
          </>
        )}
        {action === "correct" && (
          <>
            <SelectField label="What needs correction?">
              <option>Delivery receipt / quantity</option>
              <option>Invoice amount</option>
              <option>Buyer entity</option>
            </SelectField>
            <label className="field">
              <span>Correction note</span>
              <textarea placeholder="Describe the requested change" />
            </label>
          </>
        )}
        <Button
          variant={action === "dispute" ? "danger" : "primary"}
          onClick={() => setModal(true)}
        >
          Review and submit
        </Button>
      </div>
      {modal && (
        <Modal
          title={`${
            action === "confirm"
              ? "Confirm details"
              : action === "dispute"
                ? "Dispute claim"
                : "Request correction"
          }?`}
          danger={action === "dispute"}
          close={() => setModal(false)}
          confirm={() => {
            setModal(false)
            setDone(true)
          }}
        >
          This local preview will display a simulated response for
          CLM-2026-0042. Nothing will be sent or persisted in an audit trail.
        </Modal>
      )}
    </div>
  )
}

function Registry({ route, go }: { route: Route, go: (r: Route) => void }) {
  const [modal, setModal] = useState(false)
  const [query, setQuery] = useState("INV-2048")
  const [searched, setSearched] = useState("INV-2048")
  if (route === "reservation-conflict")
    return (
      <div className="result-page conflict">
        <div className="danger-icon">
          <Icon name="alert" size={30} />
        </div>
        <Badge tone="danger">Simulated conflict · Demo data</Badge>
        <h1>Demo reservation unavailable</h1>
        <p>
          This preview chose the conflict outcome. No atomic registry check
          occurred, and no reservation was attempted.
        </p>
        <div className="conflict-detail">
          <span>Claim</span>
          <b>CLM-2026-0042 · INV-2048</b>
          <span>Demo outcome</span>
          <b>Another participant is shown as holding a reservation</b>
          <span>Registry coverage</span>
          <b>Participating demo records only</b>
        </div>
        <div>
          <Button variant="secondary" onClick={() => go("registry-match")}>
            View demo registry record
          </Button>
          <Button onClick={() => go("decision")}>Hold for investigation</Button>
        </div>
      </div>
    )
  if (route === "reservation")
    return (
      <div className="result-page">
        <div className="success-icon">
          <Icon name="check" size={30} />
        </div>
        <Badge tone="success">Simulated success · Demo data</Badge>
        <h1>Reservation preview</h1>
        <p>
          This local preview shows a successful outcome. No reservation was
          created, persisted, or made visible to other lenders.
        </p>
        <div className="conflict-detail">
          <span>Claim</span>
          <b>CLM-2026-0042 · INV-2048</b>
          <span>Lender</span>
          <b>Horizon Capital · Demo</b>
          <span>Outcome</span>
          <b>Success state preview only · no audit event</b>
        </div>
        <Button onClick={() => go("registry-history")}>
          View demo registry history
        </Button>
      </div>
    )
  if (route === "registry-match")
    return (
      <>
        <PageHeader
          eyebrow="PARTICIPATING REGISTRY · DEMO DATA"
          title="Potential duplicate financing match"
          text="This match is a review signal from participating institutions, not proof of fraud or visibility into every lender."
        />
        <div className="alert danger">
          <Icon name="alert" />
          <span>
            <b>Active financing record found</b>The normalized invoice identity
            matches a record marked Financed. Hold further action and
            investigate.
          </span>
        </div>
        <div className="registry-columns">
          <div className="panel">
            <h2>Match basis</h2>
            {[
              ["Seller identity", "Exact normalized match"],
              ["Buyer identity", "Exact normalized match"],
              ["Invoice number", "INV-2048 · Exact"],
              ["Amount", "₹8,45,000 · Exact"],
              ["Invoice date", "14 Mar 2026 · Exact"],
              ["File hash", "Different · Re-export possible"],
            ].map((x) => (
              <div className="key-row" key={x[0]}>
                <span>{x[0]}</span>
                <b>{x[1]}</b>
              </div>
            ))}
          </div>
          <div className="panel">
            <h2>Registry record</h2>
            <div className="key-row">
              <span>Status</span>
              <Badge tone="danger">Financed</Badge>
            </div>
            <div className="key-row">
              <span>Participating institution</span>
              <b>Restricted demo reference</b>
            </div>
            <div className="key-row">
              <span>Last updated</span>
              <b>13 Mar 2026 · 16:22</b>
            </div>
            <div className="key-row">
              <span>Record ID</span>
              <b>REG-2026-1182</b>
            </div>
            <Button variant="danger" onClick={() => go("decision")}>
              Hold for investigation
            </Button>
          </div>
        </div>
      </>
    )
  if (route === "registry-history")
    return (
      <>
        <PageHeader
          eyebrow="REGISTRY LIFECYCLE"
          title="Registry history"
          text="Events apply only to this participating demo registry. They are not a legal registry of ownership."
        />
        <Timeline registry />
        <div className="panel">
          <h2>Manage registry state</h2>
          <div className="status-flow">
            {[
              "Submitted",
              "Under Review",
              "Reserved",
              "Financed",
              "Partially Financed",
              "Repaid",
              "Released",
              "Disputed",
              "Rejected",
            ].map((x) => (
              <Badge key={x} tone={x === "Reserved" ? "info" : "neutral"}>
                {x}
              </Badge>
            ))}
          </div>
          <p className="fine-print">
            Authorized status transitions require a reason, confirmation,
            backend validation, and an audit event.
          </p>
        </div>
      </>
    )
  const matches = claims.filter((c) =>
    `${c.id} ${c.invoice} ${c.seller} ${c.buyer} ${c.amount} ${c.status}`
      .toLowerCase()
      .includes(searched.trim().toLowerCase()),
  )
  return (
    <>
      <PageHeader
        eyebrow="SHARED DEMO REGISTRY"
        title="Financing registry"
        text="Search participating-lender records only. No result does not mean an invoice is unfinanced everywhere."
        actions={
          <Button onClick={() => go("registry-match")}>
            Run registry check
          </Button>
        }
      />
      <form
        className="panel registry-search"
        onSubmit={(e) => {
          e.preventDefault()
          setSearched(query)
        }}
      >
        <div className="search-box">
          <Icon name="search" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Invoice, claim, seller, buyer or amount"
            aria-label="Search demo registry"
          />
        </div>
        <Button type="submit">Search</Button>
      </form>
      <p className="fine-print">
        Showing demo registry matches for “{searched || "(empty query)"}”.
      </p>
      <div className="registry-stats">
        <article>
          <small>PARTICIPATING RECORDS</small>
          <strong>4</strong>
          <span>Visible local demo records</span>
        </article>
        <article>
          <small>ACTIVE RESERVATIONS</small>
          <strong>1</strong>
          <span>Synthetic records</span>
        </article>
        <article>
          <small>POTENTIAL MATCHES</small>
          <strong>{matches.length}</strong>
          <span>Require human review</span>
        </article>
      </div>
      <div className="panel">
        <div className="panel-head">
          <div>
            <h2>Registry results</h2>
            <p>Normalized identities and candidate matches</p>
          </div>
          <Badge tone="warning">Coverage limited · demo</Badge>
        </div>
        {matches.length ? (
          <ClaimsTable
            role="lender"
            go={() => go("registry-match")}
            records={matches}
          />
        ) : (
          <div className="panel empty">
            <b>No matching registry records</b>
            <p>
              No local demo record contains “{searched}”. This does not
              establish that an invoice is unfinanced.
            </p>
          </div>
        )}
        <div className="panel-head">
          <Button variant="secondary" onClick={() => setModal(true)}>
            Reserve this claim · demo
          </Button>
        </div>
      </div>
      {modal && (
        <Modal
          title="Preview a demo reservation outcome?"
          close={() => setModal(false)}
          confirm={() => {
            const outcome =
              Math.random() < 0.5 ? "reservation" : "reservation-conflict"
            setModal(false)
            go(outcome)
          }}
        >
          Choose a labelled local success or conflict preview. No atomic check,
          registry update, or audit event will occur.
        </Modal>
      )}
    </>
  )
}

function Timeline({ registry = false }: { registry?: boolean }) {
  const events = registry
    ? [
        "Claim submitted to registry",
        "Review started by Horizon Capital",
        "Atomic reservation confirmed",
        "Reservation event hash queued",
      ]
    : [
        "Claim submitted by seller",
        "Three documents uploaded",
        "Extraction and checks completed",
        "Registry check completed",
        "Buyer response requested",
        "Demo manifest anchor recorded",
      ]
  return (
    <div className="panel timeline">
      {events.map((x, i) => (
        <div className="timeline-event" key={x}>
          <i className={i === events.length - 1 ? "active" : ""}>
            <Icon name={i === events.length - 1 ? "link" : "check"} size={13} />
          </i>
          <span>
            <b>{x}</b>
            <small>
              {i === 0
                ? "Demo Seller"
                : i === 4
                  ? "System → Simulated Buyer"
                  : "MeiProof System"}{" "}
              · Demo preview EVT-00{42 + i} · not persisted
            </small>
          </span>
          <time>
            14 Mar · {10 + i}:4{i}
          </time>
        </div>
      ))}
    </div>
  )
}

function Audit({ route, go }: { route: Route, go: (r: Route) => void }) {
  const [state, setState] = useState<"verified" | "mismatch" | "pending">(
    "verified",
  )
  if (route === "integrity")
    return (
      <>
        <PageHeader
          eyebrow="DEMO STATE PREVIEW"
          title="File integrity state"
          text="Preview illustrative matching and mismatch states. No file is read, hashed, or compared in this prototype."
        />
        <div className="panel integrity-card">
          <div
            className={state === "mismatch" ? "danger-icon" : "success-icon"}
          >
            <Icon name={state === "mismatch" ? "alert" : "check"} size={28} />
          </div>
          <h2>
            {state === "verified"
              ? "Illustrative matching state"
              : state === "mismatch"
                ? "Illustrative mismatch state"
                : "Illustrative pending state"}
          </h2>
          <p>
            {state === "verified"
              ? "The displayed sample hashes match. No actual file bytes or stored baseline were checked."
              : state === "mismatch"
                ? "The sample hash differs. This is an illustrative review state, not a detected file change."
                : "No file is being read or processed."}
          </p>
          <div className="hash-compare">
            <span>Expected</span>
            <code>7a9f0d5c…d8b2c42e</code>
            <span>Observed</span>
            <code className={state === "mismatch" ? "bad" : ""}>
              {state === "mismatch" ? "4c81b903…e9a24a11" : "7a9f0d5c…d8b2c42e"}
            </code>
          </div>
          <Button
            variant="secondary"
            onClick={() =>
              setState(state === "mismatch" ? "verified" : "mismatch")
            }
          >
            Preview {state === "mismatch" ? "verified" : "mismatch"} state
          </Button>
        </div>
      </>
    )
  if (route === "anchor")
    return (
      <>
        <PageHeader
          eyebrow="TESTNET · DEMO ANCHOR"
          title="Blockchain anchor detail"
          text="Only a manifest hash and minimal metadata are shown. Original documents and sensitive invoice contents remain off-chain."
        />
        <div className="anchor-layout">
          <div className="panel">
            <div className="panel-head">
              <div>
                <h2>Submission manifest</h2>
                <p>Manifest v1 · Created 14 Mar 2026</p>
              </div>
          <Badge tone="info">Illustrative · Demo</Badge>
            </div>
            {[
              ["Manifest hash", "0x7a9f0d5c…d8b2c42e"],
              ["Network", "Sepolia testnet · Chain ID 11155111"],
              ["Anchor type", "Submission manifest"],
              ["Transaction", "0x92af…44d1 · Demo reference"],
              ["Block", "Demo block reference"],
              ["Included versions", "Invoice v1 · PO v1 · Delivery v1"],
            ].map((x) => (
              <div className="key-row" key={x[0]}>
                <span>{x[0]}</span>
                <code>{x[1]}</code>
              </div>
            ))}
          </div>
          <div className="panel state-stack">
            <h2>Anchor states</h2>
            <div>
              <Badge tone="warning">Pending</Badge>
              <p>Illustrative pending state only. No network request was made.</p>
            </div>
            <div>
              <Badge tone="success">Success</Badge>
              <p>Illustrative success state only. No testnet transaction was submitted or confirmed.</p>
            </div>
            <div>
              <Badge tone="danger">Failed / unknown</Badge>
              <p>
                Retry only after checking for an existing transaction to avoid
                duplicates.
              </p>
            </div>
            <Button onClick={() => go("integrity")}>
              Verify file integrity
            </Button>
          </div>
        </div>
      </>
    )
  return (
    <>
      <PageHeader
        eyebrow="CLM-2026-0042 · TAMPER-EVIDENT HISTORY"
        title="Claim audit timeline"
        text="Every important change records the actor, source, timestamp, and related version. Demo events are clearly labelled."
        actions={
          <Button variant="secondary" onClick={() => go("anchor")}>
            View manifest & anchor
          </Button>
        }
      />
      <Timeline />
      <div className="audit-actions">
        <div className="panel">
          <Icon name="link" />
          <h3>Manifest & hashes</h3>
          <p>
            Inspect included versions, SHA-256 hashes, and the demo testnet
            reference.
          </p>
          <button onClick={() => go("anchor")}>Open anchor detail →</button>
        </div>
        <div className="panel">
          <Icon name="shield" />
          <h3>Verify integrity</h3>
          <p>
            Compare authorized file bytes against the stored baseline without
            changing it.
          </p>
          <button onClick={() => go("integrity")}>Run integrity check →</button>
        </div>
        <div className="panel">
          <Icon name="upload" />
          <h3>Audit export</h3>
          <p>
            Export is not available in this MVP prototype. Access-scoped design
            only.
          </p>
          <Badge tone="neutral">Not available in MVP</Badge>
        </div>
      </div>
    </>
  )
}

function History({
  role,
  route,
  go,
}: {
  role: Role
  route: Route
  go: (r: Route) => void
}) {
  const [done, setDone] = useState(false)
  if (done)
    return (
      <div className="result-page">
        <div className="success-icon">
          <Icon name="check" size={30} />
        </div>
        <h1>{role === "lender" ? "Decision recorded" : "Response recorded"}</h1>
        <p>
          This local demo action was previewed on screen. No decision or audit
          event was persisted.
        </p>
        <Badge tone="info">Demo preview · no audit event</Badge>
        <Button onClick={() => go("audit")}>View audit timeline</Button>
      </div>
    )
  if (role === "lender")
    return (
      <>
        <PageHeader
          eyebrow="HUMAN-CONTROLLED REVIEW · DEMO"
          title="Preview lender review action"
          text="Preview a local workflow outcome. No decision is persisted; this does not approve or disburse funds."
        />
        <div className="form-layout">
          <div className="panel form-panel">
            <SelectField label="Review action">
              <option>Hold for buyer confirmation</option>
              <option>Request more evidence</option>
              <option>Escalate to investigation</option>
              <option>Mark rejected</option>
              <option>Ready for financing review</option>
            </SelectField>
            <label className="field">
              <span>Reason (required)</span>
              <textarea defaultValue="Delivery quantity mismatch requires clarification and buyer confirmation remains pending." />
            </label>
            <div className="summary-grid">
              <div>
                <span>Reviewer</span>
                <b>Priya Sharma · Horizon Capital</b>
              </div>
              <div>
                <span>Claim</span>
                <b>CLM-2026-0042</b>
              </div>
            </div>
            <div className="alert info">
              <Icon name="alert" />
              Ready for financing review is not loan approval and does not
              transfer funds.
            </div>
            <Button onClick={() => setDone(true)}>Record decision</Button>
          </div>
          <aside className="panel tip-card">
            <h3>Decision checklist</h3>
            {[
              "Evidence sources reviewed",
              "Risk dimensions considered separately",
              "Registry status checked",
              "Reason recorded",
            ].map((x) => (
              <p key={x}>
                <Icon name="check" size={14} />
                {x}
              </p>
            ))}
          </aside>
        </div>
      </>
    )
  return (
    <>
      <PageHeader
        eyebrow="SIMULATED BUYER RESPONSES"
        title="Response history"
        text="Responses for claims addressed to Northstar Manufacturing Ltd only."
      />
      <div className="panel">
        <ClaimsTable role="buyer" go={() => go("buyer-response")} />
      </div>
    </>
  )
}

function Utility({
  route,
  role,
  go,
}: {
  route: Route
  role: Role
  go: (r: Route) => void
}) {
  const [readNotifications, setReadNotifications] = useState<string[]>([])
  if (["access-denied", "not-found", "unavailable"].includes(route)) {
    const messages: Partial<Record<Route, [string, string]>> = {
      "access-denied": [
        "Access denied",
        "Your assigned demo workspace does not have permission to view this record. No private record details were disclosed.",
      ],
      "not-found": [
        "Page not found",
        "The page may have moved or the route is not available in this prototype.",
      ],
      unavailable: [
        "Service unavailable in this prototype",
        "Verification, registry, authentication, email, and chain services are not connected. No live request was made.",
      ],
    }
    const d = messages[route] ?? messages["not-found"]!
    return (
      <div className="result-page">
        <div className="danger-icon">
          <Icon name={route === "not-found" ? "search" : "alert"} size={30} />
        </div>
        <h1>{d[0]}</h1>
        <p>{d[1]}</p>
        <Button onClick={() => go("dashboard")}>
          Return to {role} dashboard
        </Button>
      </div>
    )
  }
  if (route === "states")
    return (
      <>
        <PageHeader
          eyebrow="COMPONENT STATES"
          title="Loading, empty, error & validation"
          text="Reusable operational states for claims, tables, documents, audit records, and service responses."
        />
        <StateShowcase />
      </>
    )
  if (route === "notifications")
    return (
      <>
        <PageHeader
          title="Notifications"
          text="Simulated workflow notices for the current demo workspace."
        />
        <div className="panel notification-list">
          {[
            [
              "Buyer response needed",
              "CLM-2026-0042 is awaiting a simulated independent response.",
              "warning",
              "buyer-response",
            ],
            [
              "Verification preview",
              "Demo checks are shown for CLM-2026-0041.",
              "success",
              "verification",
            ],
            [
              "Potential registry match",
              "A participating-registry demo candidate requires review.",
              "danger",
              "registry-match",
            ],
            [
              "Demo anchor reference",
              "A synthetic manifest reference is shown; no chain request was made.",
              "info",
              "anchor",
            ],
          ].map(([title, description, tone, target]) => (
            <button
              key={title}
              className={readNotifications.includes(title) ? "read" : "unread"}
              aria-label={`${title}. ${readNotifications.includes(title) ? "Read" : "Unread"}. Open related demo record`}
              onClick={() => {
                setReadNotifications((current) => current.includes(title) ? current : [...current, title])
                go(target as Route)
              }}
            >
              <i className={tone}>
                <Icon name={tone === "danger" ? "alert" : "bell"} />
              </i>
              <span>
                <b>{title}</b>
                <small>{description}</small>
              </span>
              <time>{readNotifications.includes(title) ? "Read · demo" : "Unread · demo"}</time>
            </button>
          ))}
        </div>
      </>
    )
  if (route === "help")
    return (
      <>
        <PageHeader
          title="Help & evidence glossary"
          text="Plain-language definitions for the signals used throughout MeiProof."
        />
        <div className="glossary">
          {[
            [
              "Transaction integrity risk",
              "Review concern based on mismatches, missing evidence, duplicates, buyer response, and file integrity—not a probability of fraud.",
            ],
            [
              "Buyer payment risk",
              "Explainable indicators from supplied synthetic payment history—not an external credit score.",
            ],
            [
              "Buyer confirmation",
              "A separate buyer response to the details shown—not a guarantee of payment.",
            ],
            [
              "Shared registry",
              "Participating institutions’ records only; it cannot see every lender.",
            ],
            [
              "File hash",
              "A fingerprint used to detect changes to recorded bytes; it does not prove truth.",
            ],
            [
              "Testnet anchor",
              "A demo blockchain transaction reference for a manifest hash; private files remain off-chain.",
            ],
          ].map((x) => (
            <article key={x[0]}>
              <h3>{x[0]}</h3>
              <p>{x[1]}</p>
            </article>
          ))}
        </div>
      </>
    )
  if (route === "search") return <SearchPage role={role} go={go} />
  const security = route === "security"
  return <SettingsPage security={security} role={role} go={go} />
}

function SearchPage({ role, go }: { role: Role, go: (r: Route) => void }) {
  const [query, setQuery] = useState("")
  const results = claims.filter((c) =>
    `${c.id} ${c.invoice} ${c.seller} ${c.buyer} ${c.amount} ${c.status}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  )
  return (
    <>
      <PageHeader
        title="Search permitted demo records"
        text={`Search the local synthetic dataset for the current ${role} demo workspace.`}
      />
      <form
        className="panel registry-search"
        onSubmit={(event) => event.preventDefault()}
      >
        <div className="search-box">
          <Icon name="search" />
          <input
            autoFocus
            aria-label="Search demo claims"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Claim, invoice, organization, amount"
          />
        </div>
        <Button type="submit">Search</Button>
        <Button variant="secondary" onClick={() => setQuery("")}>
          Clear
        </Button>
      </form>
      <p className="fine-print">
        {results.length} matching local demo record
        {results.length === 1 ? "" : "s"}.
      </p>
      <div className="panel">
        {results.length ? (
          <ClaimsTable
            role={role}
            go={() => go(role === "lender" ? "review" : "claim-detail")}
            records={results}
          />
        ) : (
          <div className="panel empty">
            <b>No matching demo records</b>
            <p>Change your query to search the available synthetic claims.</p>
          </div>
        )}
      </div>
    </>
  )
}

function SettingsPage({
  security,
  role,
  go,
}: {
  security: boolean
  role: Role
  go: (r: Route) => void
}) {
  const org =
    role === "seller"
      ? "Aster Components Pvt Ltd"
      : role === "buyer"
        ? "Northstar Manufacturing Ltd"
        : "Horizon Capital"
  const [name, setName] = useState("Demo User")
  const [email, setEmail] = useState("user@example.com")
  const [organization, setOrganization] = useState(org)
  const [saved, setSaved] = useState(false)
  return (
    <>
      <PageHeader
        title={security ? "Security settings" : "Profile & organization"}
        text={
          security
            ? "Password, email, and session services are not connected in this demo."
            : "Edit a local profile preview. Changes do not persist outside this browser session."
        }
      />
      <div className="settings-layout">
        <nav>
          <button
            className={!security ? "active" : ""}
            onClick={() => go("profile")}
          >
            Profile & organization
          </button>
          <button
            className={security ? "active" : ""}
            onClick={() => go("security")}
          >
            Security
          </button>
          <button onClick={() => go("states")}>System states</button>
        </nav>
        <div className="panel form-panel">
          {security ? (
            <>
              <h2>Security controls</h2>
              <div className="alert info">
                <Icon name="lock" />
                Authentication is not connected. Password updates, email
                verification changes, and session control are unavailable in
                this prototype.
              </div>
              <Button disabled title="Not available in this prototype">
                Update password · unavailable
              </Button>
              <hr />
              <h2>Account security</h2>
              <div className="key-row">
                <span>Email verification</span>
                <Badge>Not connected</Badge>
              </div>
              <div className="key-row">
                <span>Multi-factor authentication</span>
                <Badge>Not available in this prototype</Badge>
              </div>
              <Button
                variant="secondary"
                disabled
                title="Not available in this prototype"
              >
                Revoke other sessions · unavailable
              </Button>
            </>
          ) : (
            <>
              <h2>Profile details · local preview</h2>
              <div className="form-grid">
                <Field label="Full name" value={name} onChange={setName} />
                <Field label="Work email" value={email} onChange={setEmail} />
                <Field
                  label="Organization"
                  value={organization}
                  onChange={setOrganization}
                />
                <Field label="Assigned role · demo only" defaultValue={role} />
              </div>
              <div className="alert info">
                <Icon name="lock" />
                This preview can change local display text only. It cannot grant
                access or change permissions.
              </div>
              <Button onClick={() => setSaved(true)}>Save local preview</Button>
              {saved && (
                <p role="status" className="fine-print">
                  Profile preview saved for this page session. No account record
                  was changed.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}

function StateShowcase({ compact = false }: { compact?: boolean }) {
  if (compact)
    return (
      <div className="state-links">
        <Badge>Empty: no claims yet</Badge>
        <Badge>Filtered: no results</Badge>
        <Badge tone="warning">Processing · demo</Badge>
        <Badge tone="danger">Service error · simulated</Badge>
      </div>
    )
  return (
    <div className="state-grid">
      <article className="panel">
        <div className="skeleton wide" />
        <div className="skeleton" />
        <div className="skeleton short" />
        <b>Loading skeleton · demo preview</b>
        <p>Example presentation state only; no records are loading.</p>
      </article>
      <article className="panel empty">
        <i>
          <Icon name="file" size={26} />
        </i>
        <b>No claims in this preview</b>
        <p>Continue to the claims page to explore local synthetic records.</p>
        <Button
          variant="secondary"
          onClick={() =>
            document.querySelector<HTMLElement>(".shell")?.scrollIntoView()
          }
        >
          Return to workspace
        </Button>
      </article>
      <article className="panel">
        <div className="alert danger">
          <Icon name="alert" />
          <span>
            <b>Simulated service error</b>This is a component preview, not a
            live error.
          </span>
        </div>
        <Button
          variant="secondary"
          disabled
          title="Retry is unavailable because this is a static state preview"
        >
          Retry · unavailable
        </Button>
      </article>
      <article className="panel">
        <Field
          label="Invoice number"
          defaultValue="INV/??"
          error="Use letters, numbers, hyphens, or slashes only."
        />
        <div className="alert warning">
          <Icon name="upload" />
          File exceeds the configured size limit · demo.
        </div>
      </article>
    </div>
  )
}

function LiveNewClaim({ go, onCreated }: { go: (r: Route, claimId?: string) => void, onCreated: () => Promise<void> }) {
  const [step, setStep] = useState(1)
  const [invoiceNumber, setInvoiceNumber] = useState("")
  const [invoiceDate, setInvoiceDate] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [purchaseOrder, setPurchaseOrder] = useState("")
  const [currency, setCurrency] = useState("INR")
  const [amount, setAmount] = useState("")
  const [buyerOrganizationId, setBuyerOrganizationId] = useState("")
  const [organizations, setOrganizations] = useState<ApiOrganization[]>([])
  const [files, setFiles] = useState<{ file: File; documentType: string }[]>([])
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([])
  const [createdId, setCreatedId] = useState<string | null>(null)
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    backendApi.organizations("buyer")
      .then(({ organizations: rows }) => setOrganizations(rows))
      .catch((error) => setMessage(error instanceof Error ? error.message : "Buyer organizations could not be loaded."))
  }, [])

  const submit = async () => {
    if (busy) return
    setBusy(true)
    setMessage("")
    try {
      let claimId = createdId
      if (!claimId) {
        const result = await backendApi.createClaim({
          buyer_organization_id: buyerOrganizationId,
          invoice_number: invoiceNumber.trim(),
          invoice_date: invoiceDate || null,
          due_date: dueDate || null,
          currency,
          amount: Number(amount),
          purchase_order_reference: purchaseOrder.trim(),
        })
        claimId = result.claim.id
        setCreatedId(claimId)
      }
      for (const item of files) {
        const key = `${item.file.name}-${item.file.lastModified}`
        if (uploadedFiles.includes(key)) continue
        await backendApi.uploadDocument(claimId, item.documentType, item.file)
        setUploadedFiles((current) => current.includes(key) ? current : [...current, key])
      }
      if (files.length) await backendApi.extract(claimId)
      await backendApi.verify(claimId)
      await onCreated()
      go("claim-detail", claimId)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The claim could not be submitted.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader eyebrow="AUTHENTICATED SELLER WORKFLOW" title="Create invoice claim" text="This submits the claim and selected evidence to the MeiProof API using your signed-in account." />
      <div className="flow-stepper">
        {["Invoice details", "Upload evidence", "Review & submit"].map((label, index) => <div className={step >= index + 1 ? "active" : ""} key={label}><span>{step > index + 1 ? <Icon name="check" size={14} /> : index + 1}</span><b>{label}</b></div>)}
      </div>
      <div className="form-layout">
        <div className="panel form-panel">
          {step === 1 && <>
            <h2>Invoice details</h2>
            <div className="form-grid">
              <Field label="Invoice number" value={invoiceNumber} onChange={setInvoiceNumber} />
              <Field label="Invoice date" type="date" value={invoiceDate} onChange={setInvoiceDate} />
              <Field label="Due date" type="date" value={dueDate} onChange={setDueDate} />
              <Field label="Purchase order reference" value={purchaseOrder} onChange={setPurchaseOrder} />
              <SelectField label="Buyer organization" value={buyerOrganizationId} onChange={setBuyerOrganizationId}>
                <option value="">Choose a buyer organization</option>
                {organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
              </SelectField>
              <SelectField label="Currency" value={currency} onChange={setCurrency}><option value="INR">INR — Indian Rupee</option><option value="USD">USD — US Dollar</option></SelectField>
              <Field label="Invoice total" type="number" value={amount} onChange={setAmount} />
            </div>
          </>}
          {step === 2 && <>
            <h2>Supporting evidence</h2>
            <p>Files are uploaded to the backend and private Storage. The API validates type and size and records a SHA-256 fingerprint.</p>
            <input ref={fileInput} className="visually-hidden" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" multiple onChange={(event) => setFiles((current) => [...current, ...Array.from(event.target.files ?? []).map((file) => ({ file, documentType: "other" }))])} />
            <div className="upload-zone"><Icon name="upload" size={28} /><b>Choose evidence files</b><span>PDF, PNG, JPG, WebP · maximum 20 MiB each</span><Button variant="secondary" onClick={() => fileInput.current?.click()}>Browse files</Button></div>
            {files.map((item, index) => <div className="file-row" key={`${item.file.name}-${item.file.lastModified}`}>
              <i><Icon name="file" /></i><span><b>{item.file.name}</b><small>{(item.file.size / 1024).toFixed(1)} KB · {uploadedFiles.includes(`${item.file.name}-${item.file.lastModified}`) ? "uploaded" : "uploads on submit"}</small></span>
              <SelectField label={`Type for ${item.file.name}`} value={item.documentType} onChange={(documentType) => setFiles((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, documentType } : entry))}><option value="invoice">Invoice</option><option value="purchase_order">Purchase order</option><option value="delivery_receipt">Delivery receipt</option><option value="contract">Contract</option><option value="other">Other</option></SelectField>
              <button aria-label={`Remove ${item.file.name}`} onClick={() => setFiles((current) => current.filter((_, entryIndex) => entryIndex !== index))}><Icon name="close" /></button>
            </div>)}
          </>}
          {step === 3 && <>
            <h2>Review before submission</h2>
            <p>The API stores this claim, uploads evidence, and runs extraction and verification. Findings are review signals, not proof of a genuine transaction.</p>
            <div className="summary-grid"><div><span>Invoice</span><b>{invoiceNumber || "Not provided"} · {currency} {Number(amount || 0).toLocaleString("en-IN")}</b></div><div><span>Buyer</span><b>{organizations.find((item) => item.id === buyerOrganizationId)?.name || "Not selected"}</b></div><div><span>Evidence</span><b>{files.length} file{files.length === 1 ? "" : "s"}</b></div><div><span>Source</span><b>Authenticated MeiProof API</b></div></div>
          </>}
          {message && <div className="alert danger" role="alert"><Icon name="alert" />{createdId ? `Claim created, but the remaining workflow did not finish: ${message}` : message}</div>}
          {createdId && message && <Button variant="secondary" onClick={() => go("claim-detail", createdId)}>Open created claim</Button>}
          <div className="form-actions">
            <Button variant="secondary" disabled={busy} onClick={() => step > 1 ? setStep(step - 1) : go("claims")}>{step > 1 ? "Back" : "Cancel"}</Button>
            {step < 3 ? <Button disabled={busy || (step === 1 && (!invoiceNumber.trim() || !buyerOrganizationId || Number(amount) <= 0))} onClick={() => { setMessage(""); setStep(step + 1) }}>Continue <Icon name="arrow" /></Button> : <Button disabled={busy} onClick={submit}>{busy ? "Submitting to backend…" : createdId ? "Retry remaining steps" : "Submit claim and evidence"}</Button>}
          </div>
        </div>
        <aside className="panel tip-card"><Icon name="shield" /><h3>Server-side access</h3><p>The backend checks your membership and keeps original files private. A matching document does not prove the transaction occurred.</p></aside>
      </div>
    </>
  )
}

function LiveClaimDetail({ role, route, go, claimId }: { role: Role; route: Route; go: (r: Route, claimId?: string) => void; claimId: string | null }) {
  const [claim, setClaim] = useState<ApiClaim | null>(null)
  const [documents, setDocuments] = useState<ApiDocument[]>([])
  const [message, setMessage] = useState("")
  const [busyDocument, setBusyDocument] = useState<string | null>(null)
  useEffect(() => {
    if (!claimId) return
    backendApi.claim(claimId).then((result) => { setClaim(result.claim); setDocuments(result.documents); setMessage("") }).catch((error) => setMessage(error instanceof Error ? error.message : "Claim details could not be loaded."))
  }, [claimId])
  if (!claimId) return <div className="panel empty"><b>Select a backend claim first</b><p>Open Claims, Inbox, or Review queue and select an accessible record.</p><Button onClick={() => go(role === "lender" ? "review-queue" : "claims")}>Open claim list</Button></div>
  if (!claim && !message) return <div className="panel" role="status">Loading claim from backend…</div>
  if (!claim) return <div className="alert danger" role="alert">{message}</div>
  const status = claim.status.replace(/_/g, " ")
  const amount = new Intl.NumberFormat("en-IN", { style: "currency", currency: claim.currency, maximumFractionDigits: 0 }).format(Number(claim.amount))
  return <>
    <div className="claim-title"><div><button onClick={() => go(role === "lender" ? "review-queue" : "claims")}>← Back</button><small>CLAIM {claim.id} · BACKEND RECORD</small><h1>{claim.invoice_number}</h1><p>Seller {claim.seller_organization_id?.slice(0, 8) ?? "organization"} → Buyer {claim.buyer_organization_id?.slice(0, 8) ?? "organization"}</p></div><div><strong>{amount}</strong><Badge tone="info">{status}</Badge></div></div>
    <div className="tabs">{[["Overview", "claim-detail"], ["Documents & checks", "documents"], ["Risk detail", "risk"], ["Registry", "registry"], ["Audit trail", "audit"]].map(([label, target]) => <button key={target} className={route === target ? "active" : ""} onClick={() => go(target as Route, claimId)}>{label}</button>)}</div>
    <div className="review-layout"><div className="panel"><div className="panel-head"><div><h2>Claim summary</h2><p>{claim.invoice_date || "Invoice date not supplied"} · due {claim.due_date || "date not supplied"}</p></div><Button variant="secondary" onClick={() => go("documents", claimId)}>Review evidence</Button></div><div className="summary-grid four"><div><span>Invoice</span><b>{claim.invoice_number}</b></div><div><span>Currency</span><b>{claim.currency}</b></div><div><span>Integrity risk</span><b>{claim.integrity_risk_level || "Not assessed"}</b></div><div><span>Payment risk</span><b>{claim.payment_risk_level || "Not assessed"}</b></div></div><h2>Evidence files</h2>{documents.length ? documents.map((document) => <div className="file-row" key={document.id}><i><Icon name="file" /></i><span><b>{document.document_type.replace(/_/g, " ")}</b><small>{document.mime_type} · {document.size_bytes ? `${(document.size_bytes / 1024).toFixed(1)} KB` : "size unavailable"} · SHA-256 {document.sha256_hash?.slice(0, 12)}…</small></span><Button variant="ghost" disabled={busyDocument === document.id} onClick={async () => { setBusyDocument(document.id); try { const result = await backendApi.documentUrl(claimId, document.id); window.open(result.signed_url, "_blank", "noopener,noreferrer") } catch (error) { setMessage(error instanceof Error ? error.message : "File link could not be created.") } finally { setBusyDocument(null) } }}>{busyDocument === document.id ? "Opening…" : "Open securely"}</Button></div>) : <p>No evidence files are attached to this claim yet.</p>}{message && <div className="alert danger" role="alert">{message}</div>}</div><aside className="panel tip-card"><h3>Backend workflows</h3><p>All workflow actions are checked against your authenticated organization membership.</p><Button onClick={() => go("verification", claimId)}>Run evidence checks</Button><Button variant="secondary" onClick={() => go("registry", claimId)}>Check participating registry</Button>{role === "lender" && <Button variant="secondary" onClick={() => go("decision", claimId)}>Record lender review</Button>}{role === "buyer" && <Button variant="secondary" onClick={() => go("buyer-response", claimId)}>Respond as buyer</Button>}</aside></div>
  </>
}

function LiveEvidencePage({ route, role, go, claimId, refreshClaims }: { route: Route; role: Role; go: (r: Route, claimId?: string) => void; claimId: string | null; refreshClaims: () => Promise<void> }) {
  const [claim, setClaim] = useState<ApiClaim | null>(null)
  const [documents, setDocuments] = useState<ApiDocument[]>([])
  const [verification, setVerification] = useState<ApiVerification | null>(null)
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!claimId) return
    backendApi.claim(claimId).then((result) => { setClaim(result.claim); setDocuments(result.documents) }).catch((error) => setMessage(error instanceof Error ? error.message : "Claim evidence could not be loaded."))
  }, [claimId])
  if (route === "buyer-response") return <LiveBuyerResponse go={go} claimId={claimId} refreshClaims={refreshClaims} />
  if (!claimId) return <div className="panel empty"><b>Select a backend claim first</b><p>Open an accessible record from the claim list.</p><Button onClick={() => go("claims")}>Open claims</Button></div>
  const runAction = async (action: "extract" | "verify" | "duplicates") => {
    setBusy(true); setMessage("")
    try {
      if (action === "extract") {
        const result = await backendApi.extract(claimId)
        setMessage(`Extraction completed for ${result.documents.length} document(s). Review extracted values in the backend record.`)
      } else if (action === "verify") {
        const result = await backendApi.verify(claimId)
        setVerification(result)
        setClaim((current) => current ? { ...current, integrity_risk_level: result.transaction_integrity.level } : current)
      } else {
        const result = await backendApi.duplicates(claimId)
        setMessage(`${result.candidates.length} participating-registry duplicate candidate(s). ${result.disclaimer}`)
      }
      await refreshClaims()
    } catch (error) { setMessage(error instanceof Error ? error.message : "Backend action failed.") }
    finally { setBusy(false) }
  }
  return <>
    <PageHeader eyebrow={`${claim?.invoice_number ?? "CLAIM"} · BACKEND`} title={route === "risk" ? "Risk detail" : route === "documents" ? "Evidence & extraction" : "Verification findings"} text="Results come from the authenticated backend. Checks flag evidence gaps and inconsistencies; they do not establish transaction truth or creditworthiness." actions={<Button variant="secondary" onClick={() => go("claim-detail", claimId)}>Back to claim</Button>} />
    <div className="panel"><div className="panel-head"><div><h2>Evidence sources</h2><p>{documents.length} file(s) · private Storage</p></div><div className="form-actions"><Button disabled={busy} onClick={() => runAction("extract")}>{busy ? "Working…" : "Extract fields"}</Button><Button variant="secondary" disabled={busy} onClick={() => runAction("verify")}>Run verification</Button><Button variant="ghost" disabled={busy} onClick={() => runAction("duplicates")}>Check duplicates</Button></div></div>{documents.length ? documents.map((document) => <div className="file-row" key={document.id}><i><Icon name="file" /></i><span><b>{document.document_type.replace(/_/g, " ")}</b><small>SHA-256 {document.sha256_hash?.slice(0, 16)}… · {document.mime_type}</small></span><Badge tone="info">Backend file</Badge></div>) : <p>No evidence is attached. A seller can upload files from New claim or continue evidence work from the claim record.</p>}</div>
    {message && <div className={`alert ${message.includes("completed") || message.includes("candidate(s)") ? "info" : "danger"}`} role="status">{message}</div>}
    {verification && <div className="panel"><h2>Transaction integrity · {verification.transaction_integrity.level}</h2><p>{verification.disclaimer}</p>{verification.findings.map((finding, index) => <div className="finding-row" key={`${finding.code ?? finding.rule_code ?? index}`}><i className={finding.result === "pass" ? "success" : finding.result === "missing" ? "warning" : "danger"}><Icon name={finding.result === "pass" ? "check" : "alert"} /></i><span><b>{(finding.code ?? finding.rule_code ?? "finding").replace(/_/g, " ")}</b><small>{finding.summary} · Next: {finding.recommended_action}</small></span><Badge tone={finding.result === "pass" ? "success" : finding.result === "missing" ? "warning" : "danger"}>{finding.result}</Badge></div>)}<p className="fine-print">Buyer payment risk: {verification.payment_risk.risk_level} · separate from transaction integrity.</p></div>}
  </>
}

function LiveBuyerResponse({ go, claimId, refreshClaims }: { go: (r: Route, claimId?: string) => void; claimId: string | null; refreshClaims: () => Promise<void> }) {
  const [action, setAction] = useState<"confirmed" | "disputed" | "correction_requested">("confirmed")
  const [reason, setReason] = useState("")
  const [comment, setComment] = useState("")
  const [confirmedReview, setConfirmedReview] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [done, setDone] = useState(false)
  const submit = async () => {
    if (!claimId) return
    setBusy(true); setMessage("")
    try {
      await backendApi.buyerResponse(claimId, { response: action, reason_code: reason, comment })
      await refreshClaims()
      setDone(true)
      setShowConfirm(false)
    } catch (error) { setMessage(error instanceof Error ? error.message : "Buyer response was not saved."); setShowConfirm(false) }
    finally { setBusy(false) }
  }
  if (!claimId) return <div className="panel empty"><b>Select a claim addressed to your organization</b><Button onClick={() => go("inbox")}>Open inbox</Button></div>
  if (done) return <div className="result-page"><div className="success-icon"><Icon name="check" size={30} /></div><Badge tone="success">Response accepted by backend</Badge><h1>Buyer response recorded</h1><p>This response was saved through the authenticated API. It is separate evidence and does not guarantee payment.</p><Button onClick={() => go("claim-detail", claimId)}>Return to claim</Button></div>
  return <><PageHeader eyebrow="AUTHENTICATED BUYER RESPONSE" title="Respond to claim" text="The backend checks that your approved buyer membership matches this claim." actions={<Button variant="secondary" onClick={() => go("claim-detail", claimId)}>Back to claim</Button>} /><div className="panel form-panel"><SelectField label="Response" value={action} onChange={(value) => setAction(value as typeof action)}><option value="confirmed">Confirm shown details</option><option value="disputed">Dispute claim</option><option value="correction_requested">Request correction</option></SelectField>{action !== "confirmed" && <><Field label={action === "disputed" ? "Reason code" : "Correction needed"} value={reason} onChange={setReason} /><label className="field"><span>Explanation</span><textarea value={comment} onChange={(event) => setComment(event.target.value)} /></label></>}<div className="alert info"><Icon name="alert" />Your response confirms only the details reviewed. It is not a repayment guarantee or legal validation.</div>{message && <div className="alert danger" role="alert">{message}</div>}<label className="declaration"><input type="checkbox" checked={confirmedReview} onChange={(event) => setConfirmedReview(event.target.checked)} /> I reviewed this claim and understand the limits of buyer confirmation.</label><Button disabled={busy || !confirmedReview || (action !== "confirmed" && (!reason.trim() || !comment.trim()))} onClick={() => setShowConfirm(true)}>{busy ? "Sending…" : "Review and submit response"}</Button></div>{showConfirm && <Modal title="Submit buyer response?" close={() => setShowConfirm(false)} confirm={submit}>{action === "confirmed" ? "Confirm the invoice details shown for this claim." : "Submit this response and its explanation to the claim record."}</Modal>}</>
}

function LiveRegistry({ route, go, claimId, memberships, onReservationCreated, reservationId, records }: { route: Route; go: (r: Route, claimId?: string) => void; claimId: string | null; memberships: ApiMembership[]; onReservationCreated: (id: string | null) => void; reservationId: string | null; records: ClaimRecord[] }) {
  const [claim, setClaim] = useState<ApiClaim | null>(null)
  const [candidates, setCandidates] = useState<{ basis: string; opaque_claim_reference: string }[]>([])
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const [reservationOutcome, setReservationOutcome] = useState<"reserved" | "conflict" | null>(null)
  const [transition, setTransition] = useState("financed")
  const [transitionNote, setTransitionNote] = useState("")
  useEffect(() => { if (claimId) backendApi.claim(claimId).then((result) => setClaim(result.claim)).catch((error) => setMessage(error instanceof Error ? error.message : "Claim could not be loaded.")) }, [claimId])
  useEffect(() => { if (claimId && route === "registry-match") backendApi.duplicates(claimId).then((result) => setCandidates(result.candidates)).catch((error) => setMessage(error instanceof Error ? error.message : "Registry check failed.")) }, [claimId, route])
  const reserve = async () => {
    const lender = memberships.find((item) => item.role === "lender")
    if (!claimId || !lender) { setMessage("An approved lender membership is required to reserve this claim."); return }
    setBusy(true); setMessage("")
    try {
      const result = await backendApi.reserve(claimId, lender.organization_id)
      if (result.outcome === "conflict") { setReservationOutcome("conflict"); onReservationCreated(null); go("reservation-conflict", claimId) }
      else if (result.reservation_id) { setReservationOutcome("reserved"); onReservationCreated(result.reservation_id); go("reservation", claimId) }
      else setMessage(result.message)
    } catch (error) { setMessage(error instanceof Error ? error.message : "Reservation request failed.") }
    finally { setBusy(false) }
  }
  const transitionReservation = async () => {
    if (!reservationId) return
    setBusy(true); setMessage("")
    try { const result = await backendApi.transition(reservationId, { next_status: transition, note: transitionNote }); setMessage(`Backend accepted registry transition: ${result.status}. ${result.scope}`); if (["financed", "repaid", "released", "expired"].includes(transition)) onReservationCreated(null) }
    catch (error) { setMessage(error instanceof Error ? error.message : "Registry transition failed.") }
    finally { setBusy(false) }
  }
  if (route === "reservation" || route === "reservation-conflict") {
    const isConflict = route === "reservation-conflict"
    const hasMatchingResult = reservationOutcome === (isConflict ? "conflict" : "reserved")
    if (!hasMatchingResult) return <div className="result-page"><div className="danger-icon"><Icon name="alert" size={30} /></div><Badge tone="warning">No API result in this page session</Badge><h1>Reservation outcome unavailable</h1><p>Run a registry reservation from an accessible claim to retrieve its actual backend outcome.</p><Button onClick={() => go(claimId ? "registry" : "claims", claimId ?? undefined)}>Open claim registry</Button></div>
    return <div className={`result-page ${isConflict ? "conflict" : ""}`}><div className={isConflict ? "danger-icon" : "success-icon"}><Icon name={isConflict ? "alert" : "check"} size={30} /></div><Badge tone={isConflict ? "danger" : "success"}>{isConflict ? "Backend conflict" : "Reservation created by backend"}</Badge><h1>{isConflict ? "Claim unavailable" : "Reservation recorded"}</h1><p>{isConflict ? "The participating registry found an active reservation. Restricted details are not returned." : "The reservation was created through the atomic participating-registry API. It is limited to records in this MeiProof database."}</p><div className="conflict-detail"><span>Claim</span><b>{claim?.invoice_number ?? claimId ?? "Not selected"}</b><span>Reservation</span><b>{reservationId ?? "No reservation ID returned"}</b></div><Button onClick={() => go(isConflict ? "registry-match" : "registry-history", claimId ?? undefined)}>Continue to registry history</Button></div>
  }
  if (route === "registry-history") return <><PageHeader eyebrow="BACKEND REGISTRY LIFECYCLE" title="Registry history" text="Reservation transitions are validated and persisted by the API and database." />{reservationId ? <div className="panel form-panel"><SelectField label="Next status" value={transition} onChange={setTransition}><option value="partially_financed">Partially financed</option><option value="financed">Financed</option><option value="repaid">Repaid</option><option value="released">Released</option><option value="expired">Expired</option></SelectField><Field label="Transition note" value={transitionNote} onChange={setTransitionNote} /><Button disabled={busy} onClick={transitionReservation}>{busy ? "Saving…" : "Record transition"}</Button></div> : <div className="panel empty"><b>No reservation created in this session</b><p>Open a claim and reserve it before recording a lifecycle transition.</p></div>}{message && <div className="alert info" role="status">{message}</div>}</>
  if (!claimId) return <><PageHeader eyebrow="PARTICIPATING REGISTRY" title="Choose a claim" text="Registry checks are scoped to accessible MeiProof claims." /><div className="panel">{records.map((record) => <div className="finding-row" key={record.id}><span><b>{record.invoice}</b><small>{record.id}</small></span><Button variant="secondary" onClick={() => go("registry", record.id)}>Check registry</Button></div>)}{!records.length && <p>No accessible backend claims are available.</p>}</div></>
  return <><PageHeader eyebrow="PARTICIPATING REGISTRY · BACKEND" title={route === "registry-match" ? "Registry check result" : "Financing registry"} text="This check covers participating MeiProof records only and does not establish that an invoice is unfinanced elsewhere." actions={<Button variant="secondary" onClick={() => go("claim-detail", claimId)}>Back to claim</Button>} /><div className="panel"><h2>{claim?.invoice_number ?? "Loading claim…"}</h2><p>{claim?.currency} {claim?.amount} · {claim?.status?.replace(/_/g, " ")}</p>{route === "registry-match" && <><h3>Duplicate candidates</h3>{candidates.length ? candidates.map((candidate) => <div className="finding-row" key={candidate.opaque_claim_reference}><span><b>{candidate.basis.replace(/_/g, " ")}</b><small>Opaque reference · {candidate.opaque_claim_reference}</small></span><Badge tone="warning">Review candidate</Badge></div>) : <p>No matching accessible claim was returned by the participating registry.</p>}</>}<div className="alert info"><Icon name="alert" />A registry check only covers records submitted to this shared database.</div>{roleCanReserve(memberships) && <Button disabled={busy || !claim} onClick={reserve}>{busy ? "Checking reservation…" : "Reserve claim"}</Button>}{message && <div className="alert danger" role="alert">{message}</div>}</div></>
}

function roleCanReserve(memberships: ApiMembership[]) { return memberships.some((item) => item.role === "lender") }

function LiveLenderReview({ go, claimId, refreshClaims }: { go: (r: Route, claimId?: string) => void; claimId: string | null; refreshClaims: () => Promise<void> }) {
  const [decision, setDecision] = useState("request_information")
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [saved, setSaved] = useState(false)
  const save = async () => {
    if (!claimId) return
    setBusy(true); setMessage("")
    try { const result = await backendApi.lenderReview(claimId, { decision, note }); await refreshClaims(); setMessage(result.disclaimer); setSaved(true) }
    catch (error) { setMessage(error instanceof Error ? error.message : "Lender review could not be saved.") }
    finally { setBusy(false) }
  }
  if (!claimId) return <div className="panel empty"><b>Choose a claim from the lender review queue</b><Button onClick={() => go("review-queue")}>Open review queue</Button></div>
  if (saved) return <div className="result-page"><div className="success-icon"><Icon name="check" size={30} /></div><Badge tone="success">Persisted by backend</Badge><h1>Review decision recorded</h1><p>{message}</p><Button onClick={() => go("claim-detail", claimId)}>Return to claim</Button></div>
  return <><PageHeader eyebrow="AUTHENTICATED LENDER REVIEW" title="Record review decision" text="This records a human review action. It does not approve or disburse funds." actions={<Button variant="secondary" onClick={() => go("claim-detail", claimId)}>Back to claim</Button>} /><div className="panel form-panel"><SelectField label="Review action" value={decision} onChange={setDecision}><option value="request_information">Request more information</option><option value="pending">Hold for further review</option><option value="declined">Decline claim</option><option value="approved_for_financing">Ready for financing consideration</option></SelectField><label className="field"><span>Review note</span><textarea value={note} onChange={(event) => setNote(event.target.value)} /></label><div className="alert info"><Icon name="alert" />“Ready for financing consideration” is a lender review record and does not transfer funds.</div>{message && <div className="alert danger" role="alert">{message}</div>}<Button disabled={busy} onClick={save}>{busy ? "Saving decision…" : "Record decision"}</Button></div></>
}

export default function App() {
  const [route, setRoute] = useState<Route>(routeFromLocation)
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(() => new URLSearchParams(window.location.search).get("claimId"))
  const [role, setRole] = useState<Role>("seller")
  const [demoSession, setDemoSession] = useState(false)
  const [demoAccountSession, setDemoAccountSession] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [membershipRole, setMembershipRole] = useState<Role | null>(null)
  const [membershipMessage, setMembershipMessage] = useState("")
  const [authReady, setAuthReady] = useState(!supabaseConfigured)
  const [membershipReady, setMembershipReady] = useState(!supabaseConfigured)
  const [apiStatus, setApiStatus] = useState<"checking" | "online" | "offline">("checking")
  const [apiError, setApiError] = useState("")
  const [liveClaims, setLiveClaims] = useState<ClaimRecord[]>([])
  const [memberships, setMemberships] = useState<ApiMembership[]>([])
  const [reservationId, setReservationId] = useState<string | null>(() => sessionStorage.getItem("meiproof-reservation-id"))
  const apiEnabled = Boolean(supabaseConfigured && !demoSession && userId && membershipRole)
  useEffect(() => {
    document.title =
      route === "landing"
        ? "MeiProof — Evidence-first invoice review"
        : `MeiProof — ${route.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}`
  }, [route])
  useEffect(() => {
    let active = true
    backendApi.health()
      .then(() => { if (active) setApiStatus("online") })
      .catch(() => { if (active) setApiStatus("offline") })
    return () => { active = false }
  }, [])
  useEffect(() => {
    const onPopState = () => {
      setRoute(routeFromLocation())
      setSelectedClaimId(new URLSearchParams(window.location.search).get("claimId"))
    }
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])
  const refreshClaims = async () => {
    if (!apiEnabled) return
    const result = await backendApi.claims()
    setLiveClaims(result.claims.map(apiClaimRecord))
    setApiError("")
  }
  useEffect(() => {
    if (!apiEnabled) {
      setLiveClaims([])
      setMemberships([])
      setApiError("")
      return
    }
    let active = true
    Promise.all([backendApi.me(), backendApi.claims()])
      .then(([meResult, claimResult]) => {
        if (!active) return
        setMemberships(meResult.memberships)
        setLiveClaims(claimResult.claims.map(apiClaimRecord))
        setApiError("")
      })
      .catch((error) => {
        if (active) setApiError(error instanceof Error ? error.message : "Backend data could not be loaded.")
      })
    return () => { active = false }
  }, [apiEnabled, userId])
  useEffect(() => {
    if (!supabase) return
    let active = true
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthReady(true)
      setUserId(session?.user.id ?? null)
      setDemoAccountSession(session?.user.app_metadata?.meiproof_demo === true)
      if (!session) {
        setRole("seller")
        setMembershipRole(null)
        setMembershipMessage("")
        setMembershipReady(true)
        return
      }
      setMembershipReady(false)
      window.setTimeout(async () => {
        try {
          const assignedRole = await getMembershipRole(session.user.id)
          if (active) {
            setMembershipRole(assignedRole)
            setRole(assignedRole ?? "seller")
            setMembershipMessage("")
          }
        } catch (error) {
          if (active) {
            setMembershipRole(null)
            setRole("seller")
            setMembershipMessage(error instanceof Error ? error.message : "Membership lookup failed.")
          }
        } finally {
          if (active) setMembershipReady(true)
        }
      }, 0)
    })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])
  const publicRoutes = useMemo(
    () =>
      new Set<Route>([
        "landing",
        "platform",
        "how",
        "trust",
        "faq",
        "contact",
        "legal",
      ]),
    [],
  )
  const authRoutes = useMemo(
    () =>
      new Set<Route>([
        "login",
        "register",
        "verify-email",
        "access-pending",
        "forgot",
        "reset",
        "session-expired",
      ]),
    [],
  )
  const claimContextRoutes = new Set<Route>(["claim-detail", "review", "verification", "documents", "risk", "buyer-response", "registry", "registry-match", "reservation", "reservation-conflict", "registry-history", "decision", "audit", "anchor", "integrity"])
  const go = (r: Route, claimId?: string) => {
    const nextClaimId = claimId ?? (claimContextRoutes.has(r) ? selectedClaimId : null)
    setSelectedClaimId(nextClaimId)
    const nextPath = `${routePaths[r]}${nextClaimId && claimContextRoutes.has(r) ? `?claimId=${encodeURIComponent(nextClaimId)}` : ""}`
    if (`${window.location.pathname}${window.location.search}` !== nextPath) {
      window.history.pushState({}, "", nextPath)
    }
    setRoute(r)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }
  const routeRequiresAuth =
    !publicRoutes.has(route) &&
    !authRoutes.has(route) &&
    route !== "not-found" &&
    route !== "unavailable"
  useEffect(() => {
    if (!supabaseConfigured || !authReady || demoSession) return
    if (routeRequiresAuth && !userId) go("login")
    else if (routeRequiresAuth && userId && membershipReady && !membershipRole) go("access-pending")
    else if (["login", "register", "forgot", "verify-email"].includes(route) && userId && membershipReady && membershipRole) go("dashboard")
  }, [authReady, demoSession, membershipReady, membershipRole, route, routeRequiresAuth, userId])
  const startDemoSession = (selectedRole: Role) => {
    setRole(selectedRole)
    setDemoSession(true)
  }
  const authProps = { go, setRole, onDemoLogin: startDemoSession }
  if (publicRoutes.has(route)) return <Public route={route} go={go} />
  if (!supabaseConfigured && !demoModeEnabled)
    return <Auth route="login" {...authProps} />
  if (supabaseConfigurationError)
    return <Auth route="login" {...authProps} />
  if (supabaseConfigured && !demoSession && (!authReady || (routeRequiresAuth && userId && !membershipReady)))
    return (
      <main className="auth-page" role="status" aria-live="polite">
        <div className="auth-main">
          <div className="auth-card centered">
            <Brand />
            <small>SECURE SESSION</small>
            <h1>Restoring your session</h1>
            <p>Checking your MeiProof account and approved workspace access.</p>
          </div>
        </div>
      </main>
    )
  if (supabaseConfigured && !demoSession && routeRequiresAuth && (!userId || !membershipReady || !membershipRole))
    return <Auth route={userId ? "access-pending" : "login"} {...authProps} statusMessage={membershipMessage ? `Workspace access could not be checked. ${membershipMessage}` : undefined} />
  if (authRoutes.has(route))
    return <Auth route={route} {...authProps} statusMessage={route === "access-pending" && membershipMessage ? `Workspace access could not be checked. ${membershipMessage}` : undefined} />
  return (
    <Shell
      role={role}
      demoAccountSession={demoAccountSession}
      route={route}
      go={go}
      apiStatus={apiStatus}
      apiEnabled={apiEnabled}
      apiError={apiError}
      liveClaims={liveClaims}
      selectedClaimId={selectedClaimId}
      memberships={memberships}
      refreshClaims={refreshClaims}
      onReservationCreated={(id) => {
        setReservationId(id)
        if (id) sessionStorage.setItem("meiproof-reservation-id", id)
        else sessionStorage.removeItem("meiproof-reservation-id")
      }}
      reservationId={reservationId}
      logout={async () => {
        if (supabase && !demoSession) {
          const { error } = await supabase.auth.signOut()
          if (error) {
            window.alert(`Could not sign out: ${error.message}`)
            return
          }
        }
        setDemoSession(false)
        setLiveClaims([])
        setMemberships([])
        setSelectedClaimId(null)
        setRole("seller")
        go("login")
      }}
    />
  )
}
