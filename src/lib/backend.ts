import { supabase } from "./supabase"

const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim()
export const backendBaseUrl = (
  configuredBaseUrl || "http://127.0.0.1:8000"
).replace(/\/+$/, "")

export type ApiClaim = {
  id: string
  invoice_number: string
  invoice_date: string | null
  due_date: string | null
  currency: string
  amount: number | string
  status: string
  integrity_risk_level: string | null
  payment_risk_level: string | null
  seller_organization_id?: string
  buyer_organization_id?: string
  created_at?: string
  updated_at?: string
}

export type ApiMembership = {
  organization_id: string
  role: "seller" | "buyer" | "lender"
}
export type ApiOrganization = { id: string; name: string; kind: string }

export class BackendError extends Error {
  status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = "BackendError"
    this.status = status
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  authenticated = true,
): Promise<T> {
  const headers = new Headers(init.headers)
  if (
    !(init.body instanceof FormData) &&
    init.body &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json")
  }
  if (authenticated) {
    if (!supabase)
      throw new BackendError(
        "Sign in with an approved MeiProof account to use the backend.",
      )
    const { data, error } = await supabase.auth.getSession()
    if (error) throw new BackendError(error.message)
    const token = data.session?.access_token
    if (!token)
      throw new BackendError(
        "Your Supabase session is missing. Sign in again to use backend workflows.",
        401,
      )
    headers.set("Authorization", `Bearer ${token}`)
  }

  let response: Response
  try {
    response = await fetch(`${backendBaseUrl}${path}`, { ...init, headers })
  } catch {
    throw new BackendError(
      `Could not reach the MeiProof API at ${backendBaseUrl}. Start FastAPI and check VITE_API_BASE_URL.`,
    )
  }

  const payload =
    response.status === 204 ? null : await response.json().catch(() => null)
  if (!response.ok) {
    const message =
      payload?.error?.message ||
      payload?.detail ||
      payload?.message ||
      `Backend request failed (${response.status}).`
    throw new BackendError(message, response.status)
  }
  return payload as T
}

export const backendApi = {
  health: () =>
    request<{ status: string; service: string; demo_mode: boolean }>(
      "/health",
      {},
      false,
    ),
  demoLogin: () =>
    request<{ access_token: string; refresh_token: string }>(
      "/api/demo-login",
      { method: "POST" },
      false,
    ),
  me: () =>
    request<{ user_id: string; memberships: ApiMembership[] }>("/api/me"),
  claims: () =>
    request<{ claims: ApiClaim[]; disclaimer: string }>("/api/claims"),
  organizations: (kind: "buyer") =>
    request<{ organizations: ApiOrganization[] }>(
      `/api/organizations?kind=${kind}`,
    ),
  claim: (claimId: string) =>
    request<{ claim: ApiClaim; documents: ApiDocument[]; disclaimer: string }>(
      `/api/claims/${encodeURIComponent(claimId)}`,
    ),
  createClaim: (body: Record<string, unknown>) =>
    request<{ claim: ApiClaim; disclaimer: string }>("/api/claims", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  uploadDocument: (claimId: string, documentType: string, file: File) => {
    const body = new FormData()
    body.set("file", file)
    return request<ApiDocument>(
      `/api/claims/${encodeURIComponent(claimId)}/documents?document_type=${encodeURIComponent(documentType)}`,
      { method: "POST", body },
    )
  },
  documentUrl: (claimId: string, documentId: string) =>
    request<{ signed_url: string; expires_in: number }>(
      `/api/claims/${encodeURIComponent(claimId)}/documents/${encodeURIComponent(documentId)}/url`,
    ),
  extract: (claimId: string) =>
    request<ApiExtraction>(
      `/api/claims/${encodeURIComponent(claimId)}/extract`,
      { method: "POST" },
    ),
  verify: (claimId: string) =>
    request<ApiVerification>(
      `/api/claims/${encodeURIComponent(claimId)}/verify`,
      { method: "POST", body: JSON.stringify({ ruleset: "meiproof-mvp" }) },
    ),
  duplicates: (claimId: string) =>
    request<{
      scope: string
      candidates: { basis: string; opaque_claim_reference: string }[]
      disclaimer: string
    }>(`/api/claims/${encodeURIComponent(claimId)}/duplicates`),
  buyerResponse: (
    claimId: string,
    body: {
      response: "confirmed" | "disputed" | "correction_requested"
      reason_code?: string
      comment?: string
    },
  ) =>
    request<{ status: string; simulated: boolean; disclaimer: string }>(
      `/api/claims/${encodeURIComponent(claimId)}/buyer-response`,
      { method: "POST", body: JSON.stringify(body) },
    ),
  reserve: (claimId: string, lenderOrganizationId: string) =>
    request<{
      outcome: string
      reservation_id?: string
      message: string
      scope: string
      simulated: boolean
    }>(`/api/claims/${encodeURIComponent(claimId)}/registry/reserve`, {
      method: "POST",
      body: JSON.stringify({
        lender_organization_id: lenderOrganizationId,
        reservation_hours: 24,
      }),
    }),
  transition: (
    reservationId: string,
    body: { next_status: string; note: string; financed_amount?: number },
  ) =>
    request<{ status: string; simulated: boolean; scope: string }>(
      `/api/registry/${encodeURIComponent(reservationId)}/transition`,
      { method: "POST", body: JSON.stringify(body) },
    ),
  lenderReview: (claimId: string, body: { decision: string; note: string }) =>
    request<{ simulated: boolean; disclaimer: string }>(
      `/api/claims/${encodeURIComponent(claimId)}/lender-review`,
      { method: "POST", body: JSON.stringify(body) },
    ),
}

export type ApiDocument = {
  id: string
  document_type: string
  sha256_hash?: string
  extraction_status?: string
  size_bytes?: number
  mime_type?: string
  signed_url?: string
}

export type ApiExtraction = {
  claim_id: string
  documents: {
    document_id: string
    status: string
    engine: string
    field_count: number
    error_code?: string | null
    error_summary?: string | null
  }[]
  disclaimer: string
}

export type ApiVerification = {
  findings: {
    code?: string
    rule_code?: string
    result: string
    severity: string
    summary: string
    recommended_action: string
  }[]
  transaction_integrity: { level: string; simulated: boolean }
  payment_risk: { risk_level: string; simulated: boolean; explanation?: unknown }
  disclaimer: string
}
