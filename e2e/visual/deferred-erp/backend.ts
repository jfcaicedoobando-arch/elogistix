import { correoSupabase } from "./correo-backend";
import { crmSupabase } from "./crm-backend";

function selectedBackend() {
  const current = new URLSearchParams(location.search).get("case");
  if (current === "correo") return correoSupabase;
  if (current === "crm") return crmSupabase;
  throw new Error(`No Supabase client allowed for fixture ${current}`);
}

export const supabase = new Proxy({}, {
  get(_target, property) {
    const client = selectedBackend();
    const value = Reflect.get(client, property);
    if (value === undefined) throw new Error(`Unexpected Supabase API: ${String(property)}`);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export function useOrgFilter() {
  return { organizationId: "33333333-3333-4333-8333-333333333333", isReady: true };
}
export function useOrgActiva() { return { organizationId: "33333333-3333-4333-8333-333333333333" }; }
// All feedback remains visible; telemetry transport is replaced at its boundary.
export function reportCaughtError() { /* in-memory fixture: no telemetry */ }
export { useIsMobile } from "../../../src/hooks/shared/useIsMobile";
export { useDebounce } from "../../../src/hooks/shared/useDebounce";
