/**
 * facturapi-test-conexion — Verifica que la API key de FacturApi (sandbox o live)
 * para la org actual es válida llamando a `organizations/me` vía REST directo.
 *
 * Multi-tenant: la key se resuelve por `_shared/facturapiAuth.ts` (vault o env).
 * No expone la key al cliente; sólo devuelve `{ ok, ambiente, facturapi_org_id, nombre }`.
 */
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { buildCors, handlePreflightStrict } from "../_shared/cors.ts";
import { basicAuthHeader, FACTURAPI_BASE, resolveFacturapiKey } from "../_shared/facturapiAuth.ts";
import { jsonResponse, makeJson } from "../_shared/response.ts";
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

async function fetchFacturapiOrg(apiKey: string, facturapiOrgId: string | null, signal: AbortSignal): Promise<FacturapiOrg> {
  const orgId = facturapiOrgId ?? "me";
  const res = await fetch(`${FACTURAPI_BASE}/organizations/${encodeURIComponent(orgId)}`, {
    headers: { Authorization: basicAuthHeader(apiKey), Accept: "application/json" },
    signal,
  });

  if (!res.ok) {
    const detail = await readFacturapiDetail(res);
    if (res.status === 404 && facturapiOrgId) {
      console.warn("[facturapi-test-conexion] saved-org-id-not-found; retrying-me");
      return fetchFacturapiOrg(apiKey, null, signal);
    }
    throw toFacturapiError(res, detail);
  }

  return await res.json() as FacturapiOrg;
}

// REF-08: se eliminó `withTimeout` (rechazaba la promesa a los 15 s pero el
// fetch seguía vivo sin AbortSignal). Ahora el timeout es real:
// `AbortSignal.timeout(15_000)` en runTest aborta la conexión y el
// DOMException resultante se mapea a 504 en errorResponse.

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
  const { error } = await sbAdmin
    .from("facturapi_credenciales")
    .update({ facturapi_org_id: meId })
    .eq("organization_id", organizationId);
  // REF-08: no fallar la prueba por esto (es best-effort), pero dejar rastro en
  // logs — antes se ignoraba el error del UPDATE en silencio.
  if (error) console.warn("[facturapi-test-conexion] persist-org-id-failed", { message: error.message });
}

function errorResponse(err: unknown) {
  const e = (err ?? {}) as FacturapiHttpError;
  const status = e.status ?? 502;
  const detail = e.detail ?? { message: e.message ?? String(err) };
  // REF-08: AbortSignal.timeout arroja DOMException TimeoutError (AbortError
  // por robustez); ambos significan "FacturApi no respondió a tiempo".
  const isTimeout =
    (err as Error)?.message === "facturapi_timeout" ||
    (err instanceof DOMException && (err.name === "TimeoutError" || err.name === "AbortError"));
  console.error("[facturapi-test-conexion] facturapi-call-error", { status, isTimeout });
  const isAuthError = status === 401 || status === 403;
  // EF-11: propagar el status HTTP real — con 200 los clientes que sólo
  // evalúan response.ok trataban los errores de FacturApi como éxito.
  const httpStatus = isTimeout
    ? 504
    : (Number.isInteger(status) && status >= 400 && status < 600 ? status : 502);
  return jsonResponse({
    ok: false,
    status: httpStatus,
    detail: isTimeout ? { message: "Tiempo de espera agotado al contactar FacturApi (15s)." } : detail,
    message: isAuthError ? "La API key de FacturApi no es válida para este ambiente." : undefined,
  }, httpStatus);
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
    // REF-08: AbortSignal.timeout aborta el fetch de verdad (patrón de
    // _shared/satConsulta.ts y _shared/respaldarXmlTimbrado.ts).
    const me = await fetchFacturapiOrg(
      resolved.data.apiKey,
      resolved.data.facturapiOrgId,
      AbortSignal.timeout(15_000),
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
  // EF-10: endpoints con JWT usan CORS de whitelist (guía _shared/cors.ts).
  const preflight = handlePreflightStrict(req);
  if (preflight) return preflight;
  const json = makeJson(req);

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
  return await runTest(body, sbAdmin);
});

