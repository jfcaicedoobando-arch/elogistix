// Edge function: provisiona (o actualiza) los usuarios usados por la suite E2E
// de Playwright y asegura su rol + membresía correspondiente.
//
// - `admin`  → user_roles.role = 'admin' + organization_members(org_id)
// - `portal` → user_roles.role = 'cliente' + client_users(cliente_id, org_id)
//
// Protegido por header `x-e2e-secret` que debe igualar el secreto
// `E2E_PROVISION_SECRET` (runtime secret del proyecto). La lógica de upsert /
// verificación vive en `./provisioning.ts` para mantener este archivo enfocado
// en el transporte HTTP.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { primerEmailNoPermitido } from "./emailAllowlist.ts";
import {
  jsonResponse,
  provisionAdmin,
  provisionPortal,
  resolveClienteId,
  resolveOrgId,
  type ProvisionPayload,
  type UserResult,
} from "./provisioning.ts";

const json = (body: unknown, status = 200) => jsonResponse(body, status, corsHeaders);

Deno.serve(async (req) => {
  const guarded = await guard(req);
  if (guarded instanceof Response) return guarded;
  const { payload } = guarded;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const orgId = await resolveOrgId(admin, payload);
    if (!orgId) return json({ error: "no_organization_found" }, 400);

    const clienteId = await resolveClienteId(admin, payload, orgId);
    if (payload.portal && !clienteId) {
      return json({ error: "no_cliente_found_for_org", organization_id: orgId }, 400);
    }

    const results: UserResult[] = [];
    const adminRes = await provisionAdmin(admin, payload, orgId);
    if (adminRes) results.push(adminRes);
    const portalRes = await provisionPortal(admin, payload, clienteId, orgId);
    if (portalRes) results.push(portalRes);

    const allVerified = results.every((r) => r.verified);
    return json(
      {
        ok: allVerified,
        organization_id: orgId,
        cliente_id: clienteId,
        users: results,
        ...(allVerified ? {} : { error: "verification_failed" }),
      },
      allVerified ? 200 : 500,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: "provision_failed", message }, 500);
  }
});

async function guard(
  req: Request,
): Promise<Response | { payload: ProvisionPayload }> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const expected = Deno.env.get("E2E_PROVISION_SECRET");
  if (!expected) {
    return json({ error: "e2e_provision_secret_not_configured" }, 500);
  }
  if (req.headers.get("x-e2e-secret") !== expected) {
    return json({ error: "unauthorized" }, 401);
  }

  let payload: ProvisionPayload;
  try {
    payload = (await req.json()) as ProvisionPayload;
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  // A9: el secreto compartido no basta. El email objetivo debe estar en la
  // allowlist de cuentas de prueba; así nadie puede resetear la contraseña de
  // una cuenta real (ni darle rol admin) desde esta función.
  const rechazado = primerEmailNoPermitido(
    [payload.admin?.email, payload.portal?.email],
    Deno.env.get("E2E_PROVISION_EMAIL_ALLOWLIST"),
  );
  if (rechazado) {
    return json({ error: "email_not_allowed", email: rechazado }, 403);
  }

  return { payload };
}
