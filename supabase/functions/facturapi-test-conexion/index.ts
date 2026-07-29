/**
 * facturapi-test-conexion — Verifica que la API key de FacturApi (sandbox o live)
 * para la org actual es válida llamando a `organizations/me` vía REST directo.
 *
 * Multi-tenant: la key se resuelve por `_shared/facturapiAuth.ts` (vault o env).
 * No expone la key al cliente; sólo devuelve `{ ok, ambiente, facturapi_org_id, nombre }`.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { basicAuthHeader, FACTURAPI_BASE, resolveFacturapiKey } from "../_shared/facturapiAuth.ts";
import { jsonResponse } from "../_shared/response.ts";
import { authorizeOrgRole, ROLES_EMISOR_FISCAL } from "../_shared/auth.ts";

interface Body {
  organization_id: string;
  ambiente: "sandbox" | "live";
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

interface FacturapiOrg {
  id?: string;
  legal_name?: string;
  name?: string;
}

interface FacturapiHttpError extends Error {
  status?: number;
  detail?: unknown;
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
  // FIX C2 (S5-02): probar la API key fiscal exige rol emisor fiscal.
  const sbAdmin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const allowed = await authorizeOrgRole(sbAdmin, claims.claims.sub, organizationId, ROLES_EMISOR_FISCAL);
  if (!allowed) return { ok: false as const, status: 403, error: "forbidden" };
  return { ok: true as const };
}

async function readFacturapiDetail(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return { message: res.statusText };
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text };
  }
}

function toFacturapiError(res: Response, detail: unknown): FacturapiHttpError {
  const err = new Error("facturapi_http_error") as FacturapiHttpError;
  err.status = res.status;
  err.detail = detail;
  return err;
}

async function fetchFacturapiOrg(apiKey: string, facturapiOrgId: string | null): Promise<FacturapiOrg> {
  const orgId = facturapiOrgId ?? "me";
  const res = await fetch(`${FACTURAPI_BASE}/organizations/${encodeURIComponent(orgId)}`, {
    headers: { Authorization: basicAuthHeader(apiKey), Accept: "application/json" },
  });

  if (!res.ok) {
    const detail = await readFacturapiDetail(res);
    if (res.status === 404 && facturapiOrgId) {
      console.warn("[facturapi-test-conexion] saved-org-id-not-found; retrying-me");
      return fetchFacturapiOrg(apiKey, null);
    }
    throw toFacturapiError(res, detail);
  }

  return await res.json() as FacturapiOrg;
}

/**
  * Envuelve la llamada HTTP con un timeout duro. Si FacturApi tarda más de
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

async function loadCredentials(sbAdmin: ReturnType<typeof createClient>, organizationId: string) {
  const { data } = await sbAdmin
    .from("facturapi_credenciales")
    .select("api_key_sandbox_vault_id, api_key_live_vault_id, api_key_sandbox_secret_name, api_key_live_secret_name, facturapi_org_id")
    .eq("organization_id", organizationId)
    .maybeSingle();
  return data as CredRow | null;
}

async function persistOrgId(
  sbAdmin: ReturnType<typeof createClient>,
  organizationId: string,
  meId: string | undefined,
  currentOrgId: string | null,
) {
  if (!meId || currentOrgId) return;
  await sbAdmin
    .from("facturapi_credenciales")
    .update({ facturapi_org_id: meId })
    .eq("organization_id", organizationId);
}

function errorResponse(err: unknown) {
  const e = (err ?? {}) as FacturapiHttpError;
  const status = e.status ?? 502;
  const detail = e.detail ?? { message: e.message ?? String(err) };
  const isTimeout = (err as Error)?.message === "facturapi_timeout";
  console.error("[facturapi-test-conexion] facturapi-call-error", { status, isTimeout });
  const isAuthError = status === 401 || status === 403;
  return jsonResponse({
    ok: false,
    status: isTimeout ? 504 : status,
    detail: isTimeout ? { message: "Tiempo de espera agotado al contactar FacturApi (15s)." } : detail,
    message: isAuthError ? "La API key de FacturApi no es válida para este ambiente." : undefined,
  }, 200);
}

async function runTest(body: Body, sbAdmin: ReturnType<typeof createClient>) {
  const cred = await loadCredentials(sbAdmin, body.organization_id);
  if (!cred) return jsonResponse({ error: "org_facturapi_not_configured", message: "Aún no has cargado credenciales." }, 412);

  const sbForHelper = buildSupabaseLike(sbAdmin, cred, body.ambiente);
  const resolved = await resolveFacturapiKey(sbForHelper, body.organization_id);
  if (!resolved.ok) return jsonResponse(resolved.data, resolved.data.status);
  console.log("[facturapi-test-conexion] key-resolved");

  try {
    console.log("[facturapi-test-conexion] facturapi-call-start");
    const me = await withTimeout(
      fetchFacturapiOrg(resolved.data.apiKey, resolved.data.facturapiOrgId),
      15_000,
    );
    console.log("[facturapi-test-conexion] facturapi-call-ok", { id: me?.id });
    await persistOrgId(sbAdmin, body.organization_id, me?.id, resolved.data.facturapiOrgId);
    return jsonResponse({
      ok: true,
      ambiente: body.ambiente,
      facturapi_org_id: me?.id ?? null,
      nombre: me?.legal_name ?? me?.name ?? null,
    });
  } catch (err) {
    return errorResponse(err);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const body = await parseBody(req);
  if (!body) return jsonResponse({ error: "invalid_body" }, 400);

  console.log("[facturapi-test-conexion] start", { org: body.organization_id, ambiente: body.ambiente });

  const auth = await authorizeRequest(req, url, anon, body.organization_id);
  if (!auth.ok) return jsonResponse({ error: auth.error }, auth.status);
  console.log("[facturapi-test-conexion] auth-ok");

  const sbAdmin = createClient(url, service);
  return await runTest(body, sbAdmin);
});

