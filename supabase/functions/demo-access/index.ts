// Disabled release: no trusted availability provider or credentials are wired here.
// OPTIONS and public CORS remain unchanged; no request can enable provisioning.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { initSentryEdge, captureEdgeException } from "../_shared/sentry.ts";
import { createDemoAccessHandler } from "./handler.ts";

initSentryEdge("demo-access");

Deno.serve(createDemoAccessHandler({
  createAdminClient: () => createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  ),
  createProbeClient: () => createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  ),
  captureException: (error, context) => captureEdgeException(error, context),
  // Deliberately omit availabilityProvider and credentials. Any future wiring
  // requires separate review; this release always returns 503 without secrets.
}));
