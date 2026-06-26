/**
 * facturapi-test-conexion — Verifica que la API key de FacturApi (sandbox o live)
 * para la org actual es válida llamando a `organizations/me` vía SDK oficial.
 *
 * Multi-tenant: la key se resuelve por `_shared/facturapiAuth.ts` (vault o env).
 * No expone la key al cliente; sólo devuelve `{ ok, ambiente, facturapi_org_id, nombre }`.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { getFacturapiClient, describeFacturapiError } from "../_shared/facturapiClient.ts";

interface Body {
  organization_id: string;
  ambiente: "sandbox" | "live";
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const sbUser = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: claims, error: authErr } = await sbUser.auth.getClaims(authHeader.replace("Bearer ", ""));
  if (authErr || !claims?.claims?.sub) return json({ error: "unauthorized" }, 401);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_body" }, 400);
  }
  if (!body?.organization_id || (body.ambiente !== "sandbox" && body.ambiente !== "live")) {
    return json({ error: "invalid_body" }, 400);
  }

  // Verifica que el usuario pertenezca a la org (o sea super_admin)
  const { data: member } = await sbUser
    .from("organization_members")
    .select("role")
    .eq("user_id", claims.claims.sub)
    .eq("organization_id", body.organization_id)
    .maybeSingle();
  if (!member) return json({ error: "forbidden" }, 403);

  // Para forzar el ambiente solicitado, leemos directo con service role y armamos
  // un SupabaseLike que devuelve ese ambiente.
  const sbAdmin = createClient(url, service);
  const { data: cred } = await sbAdmin
    .from("facturapi_credenciales")
    .select("api_key_sandbox_vault_id, api_key_live_vault_id, api_key_sandbox_secret_name, api_key_live_secret_name, facturapi_org_id")
    .eq("organization_id", body.organization_id)
    .maybeSingle();

  if (!cred) return json({ error: "org_facturapi_not_configured", message: "Aún no has cargado credenciales." }, 412);

  const fakeRow = {
    ambiente: body.ambiente,
    api_key_sandbox_secret_name: cred.api_key_sandbox_secret_name,
    api_key_live_secret_name: cred.api_key_live_secret_name,
    api_key_sandbox_vault_id: cred.api_key_sandbox_vault_id,
    api_key_live_vault_id: cred.api_key_live_vault_id,
    facturapi_org_id: cred.facturapi_org_id,
  };
  const sbForHelper = {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: () => Promise.resolve({ data: fakeRow, error: null }) }),
      }),
    }),
    rpc: (fn: string, args: Record<string, unknown>) => sbAdmin.rpc(fn, args) as unknown as Promise<{ data: string | null; error: unknown }>,
  };

  const resolved = await getFacturapiClient(sbForHelper, body.organization_id);
  if (!resolved.ok) return json(resolved.data, resolved.data.status);

  try {
    const client = resolved.data.client as { organizations: { retrieve: (id: string) => Promise<{ id: string; legal_name?: string; name?: string }> } };
    // En cuentas single-org de FacturApi, "me" funciona; si no, requiere el id.
    const orgId = resolved.data.facturapiOrgId ?? "me";
    const me = await client.organizations.retrieve(orgId);

    // Persistir facturapi_org_id si vino y no estaba guardado
    if (me?.id && !resolved.data.facturapiOrgId) {
      await sbAdmin
        .from("facturapi_credenciales")
        .update({ facturapi_org_id: me.id })
        .eq("organization_id", body.organization_id);
    }

    return json({
      ok: true,
      ambiente: body.ambiente,
      facturapi_org_id: me?.id ?? null,
      nombre: me?.legal_name ?? me?.name ?? null,
    });
  } catch (err) {
    const { status, detail } = describeFacturapiError(err);
    return json({ ok: false, status, detail }, 200);
  }
});
