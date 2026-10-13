import { createClient } from "@supabase/supabase-js"

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
const isProjectBaseUrl = (value?: string) => {
  if (!value) return false
  try {
    const parsed = new URL(value)
    return (
      (parsed.protocol === "https:" || parsed.protocol === "http:") &&
      Boolean(parsed.hostname) &&
      parsed.pathname === "/" &&
      !parsed.search &&
      !parsed.hash
    )
  } catch {
    return false
  }
}
const hasValidProjectBaseUrl = isProjectBaseUrl(url)

export const supabaseConfigurationError =
  Boolean(url) !== Boolean(publishableKey)
    ? "Set both VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to enable Supabase."
    : url && !hasValidProjectBaseUrl
      ? "VITE_SUPABASE_URL must be the project base URL, without paths such as /auth/v1 or /rest/v1."
    : ""

export const supabaseConfigured = Boolean(url && publishableKey && hasValidProjectBaseUrl)
export const demoModeAllowed = import.meta.env.VITE_DEMO_MODE === "true"
export const demoModeEnabled = demoModeAllowed && !url && !publishableKey
export const demoAccountLoginEnabled = import.meta.env.VITE_DEMO_ACCOUNT_ENABLED === "true"

export const supabase = supabaseConfigured
  ? createClient(url!, publishableKey!, {
      auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
    })
  : null

export async function getMembershipRole(userId: string) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("user_id", userId)
  if (error) throw error
  const roles = [...new Set((data ?? []).map((membership) => membership.role))]
  return roles.length === 1 && ["seller", "buyer", "lender"].includes(roles[0])
    ? (roles[0] as "seller" | "buyer" | "lender")
    : null
}
