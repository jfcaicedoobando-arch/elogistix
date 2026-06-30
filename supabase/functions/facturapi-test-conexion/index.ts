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

async function parseBody(req: Request): Promise<Body | null> {
  try {
    const body = (await req.json()) as Body;
    if (!body?.organization_id) return null;
    if (body.ambiente !== "sandbox" && body.ambiente !== "live") return null;
    return body;
  } catch {
    return null;
  }
}

interface CredRow {
  api_key_sandbox_vault_id: string | null;
  api_key_live_vault_id: string | null;
  api_key_sandbox_secret_name: string | null;
  api_key_live_secret_name: string | null;
  facturapi_org_id: string | null;
}

function buildSupabaseLike(sbAdmin: ReturnType<typeof createClient>, cred: CredRow, ambiente: "sandbox" | "live") {
  const fakeRow = { ambiente, ...cred };
  return {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: () => Promise.resolve({ data: fakeRow, error: null }) }),
      }),
    }),
    rpc: (fn: string, args: Record<string, unknown>) =>
      sbAdmin.rpc(fn, args) as unknown as Promise<{ data: string | null; error: unknown }>,
  };
}

async function authorizeRequest(req: Request, url: string, anon: string, organizationId: string) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return { ok: false as const, status: 401, error: "unauthorized" };
  const sbUser = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: claims, error } = await sbUser.auth.getClaims(authHeader.replace("Bearer ", ""));
  if (error || !claims?.claims?.sub) return { ok: false as const, status: 401, error: "unauthorized" };
  const { data: member } = await sbUser
    .from("organization_members")
    .select("role")
    .eq("user_id", claims.claims.sub)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!member) return { ok: false as const, status: 403, error: "forbidden" };
  return { ok: true as const };
}

async function callFacturapi(resolved: { data: { client: unknown; facturapiOrgId: string | null } }) {
  const client = resolved.data.client as {
    organizations: { retrieve: (id: string) => Promise<{ id: string; legal_name?: string; name?: string }> };
  };
  const orgId = resolved.data.facturapiOrgId ?? "me";
  return await client.organizations.retrieve(orgId);
}

/**
 * Envuelve la llamada SDK con un timeout duro. Si FacturApi tarda más de
 * `ms`, rechazamos con un error semántico (`facturapi_timeout`) en vez de
 * dejar que el cliente Supabase corte ciegamente.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      const err = new Error("facturapi_timeout") as Error & { status?: number };
      err.status = 504;
      reject(err);
    }, ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const body = await parseBody(req);
  if (!body) return json({ error: "invalid_body" }, 400);

  console.log("[facturapi-test-conexion] start", { org: body.organization_id, ambiente: body.ambiente });

  const auth = await authorizeRequest(req, url, anon, body.organization_id);
  if (!auth.ok) return json({ error: auth.error }, auth.status);
  console.log("[facturapi-test-conexion] auth-ok");

  const sbAdmin = createClient(url, service);
  const { data: cred } = await sbAdmin
    .from("facturapi_credenciales")
    .select("api_key_sandbox_vault_id, api_key_live_vault_id, api_key_sandbox_secret_name, api_key_live_secret_name, facturapi_org_id")
    .eq("organization_id", body.organization_id)
    .maybeSingle();

  if (!cred) return json({ error: "org_facturapi_not_configured", message: "Aún no has cargado credenciales." }, 412);

  const sbForHelper = buildSupabaseLike(sbAdmin, cred as CredRow, body.ambiente);
  const resolved = await getFacturapiClient(sbForHelper, body.organization_id);
  if (!resolved.ok) return json(resolved.data, resolved.data.status);
  console.log("[facturapi-test-conexion] key-resolved");

  try {
    console.log("[facturapi-test-conexion] sdk-call-start");
    const me = await withTimeout(callFacturapi(resolved), 15_000);
    console.log("[facturapi-test-conexion] sdk-call-ok", { id: me?.id });
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
    const isTimeout = (err as Error)?.message === "facturapi_timeout";
    console.error("[facturapi-test-conexion] sdk-call-error", { status, isTimeout });
    return json({
      ok: false,
      status: isTimeout ? 504 : status,
      detail: isTimeout ? { message: "Tiempo de espera agotado al contactar FacturApi (15s)." } : detail,
    }, 200);
  }
});

