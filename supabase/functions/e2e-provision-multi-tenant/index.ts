// Edge function: provisiona (o limpia) DOS organizaciones dedicadas para la
// prueba E2E de aislamiento multi-tenant (`e2e/specs/26-multi-tenant-isolation.spec.ts`).
//
// - POST → crea org_a y org_b (idempotente por `nombre`), un admin en cada una,
//   y datos trazadores (cliente, embarque, factura, cotización, blob de storage).
//   El trigger `handle_new_organization` siembra automáticamente los catálogos
//   neutros (`factura_series`, `crm_etapas_pipeline`, `crm_motivos_perdida`,
//   `presupuesto_categorias`) para cada org nueva.
// - POST + `?cleanup=1` → borra las dos orgs por nombre (cascada) y sus objetos
//   en storage. Se llama al final del spec cuando pasa.
//
// Protegida por header `x-e2e-secret` = runtime secret `E2E_PROVISION_SECRET`.
// NOTA: elude la RPC `provision_organization` (que exige super_admin del caller)
// porque este pipeline corre con `service_role`. El acceso está limitado por el
// secreto compartido; NO exponer esta función a usuarios finales.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import {
  cleanupOrgsByName,
  jsonResponse,
  provisionMultiTenant,
  type MultiTenantPayload,
} from "./provisioning.ts";

const json = (body: unknown, status = 200) => jsonResponse(body, status, corsHeaders);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const expected = Deno.env.get("E2E_PROVISION_SECRET");
  if (!expected) return json({ error: "e2e_provision_secret_not_configured" }, 500);
  if (req.headers.get("x-e2e-secret") !== expected) return json({ error: "unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const url = new URL(req.url);
  const isCleanup = url.searchParams.get("cleanup") === "1";

  let payload: MultiTenantPayload;
  try {
    payload = (await req.json()) as MultiTenantPayload;
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  try {
    if (isCleanup) {
      const result = await cleanupOrgsByName(admin, [payload.org_a?.nombre, payload.org_b?.nombre]);
      return json({ ok: true, cleaned: result });
    }
    const result = await provisionMultiTenant(admin, payload);
    return json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[e2e-provision-multi-tenant]", message);
    return json({ error: "provision_failed", message }, 500);
  }
});
