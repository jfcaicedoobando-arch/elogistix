/**
 * facturapi-descargar-zip — Genera y descarga el paquete ZIP mensual de CFDI
 * de la organización usando los métodos `invoices.*ZipRequest` del SDK
 * oficial de FacturApi (v4.20.0).
 *
 * Flujo del PAC (asíncrono):
 *   1. createZipRequest({ year, month, issuer_type, invoice_types })
 *   2. Poll retrieveZipRequest(id) hasta status === "finished" (máx. ~36 s)
 *   3. downloadZipRequest(id) → binario ZIP con PDF+XML de cada CFDI
 *
 * Entrada (POST): { organization_id: string, year: number, month: number }
 * Salida: binario application/zip con Content-Disposition `cfdis-YYYY-MM.zip`.
 *
 * Pensado para el cierre contable: el contador descarga el mes completo en un
 * clic en vez de bajar factura por factura. Incluye facturas de ingreso (I),
 * notas de crédito (E) y REPs (P) emitidos en el mes.
 *
 * Multi-tenant (v13.136.0): la API key se resuelve por org vía
 * `getFacturapiClient`; NUNCA fetch directo a facturapi.io (guardrail
 * SDK-only) ni `FACTURAPI_KEY` global.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildCors, handlePreflightStrict } from "../_shared/cors.ts";
import { wrapEdgeHandler } from "../_shared/sentry.ts";
import { authorizeOrgRole, ROLES_CONSULTA_FISCAL } from "../_shared/auth.ts";
import {
  describeFacturapiError,
  extractFacturapiMessage,
  FacturapiTimeoutError,
  getFacturapiClient,
  withFacturapiTimeout,
} from "../_shared/facturapiClient.ts";
import { makeJson } from "../_shared/response.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/** Presupuesto total de espera a que el PAC ensamble el ZIP (~36 s). */
const POLL_MAX_INTENTOS = 18;
const POLL_INTERVALO_MS = 2_000;

interface ReqBody {
  organization_id?: string;
  year?: number;
  month?: number;
}

interface ZipRequest {
  id: string;
  status?: string;
}

interface InvoicesZipApi {
  createZipRequest(data: {
    year: number;
    month: number;
    issuer_type: "issuing";
    invoice_types: string[];
  }): Promise<ZipRequest>;
  retrieveZipRequest(id: string): Promise<ZipRequest>;
  downloadZipRequest(id: string): Promise<unknown>;
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Normaliza la descarga del SDK (Blob en Deno) a ArrayBuffer. */
async function aArrayBuffer(data: unknown): Promise<ArrayBuffer> {
  if (data instanceof Blob) return await data.arrayBuffer();
  if (data instanceof Uint8Array) {
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  }
  if (data && typeof (data as ReadableStream).getReader === "function") {
    return await new Response(data as ReadableStream).arrayBuffer();
  }
  throw new Error("zip_formato_desconocido");
}

/** Valida el periodo solicitado. Devuelve el error de captura o el periodo listo. */
function validarPeriodo(
  body: ReqBody,
): { error: { error: string; message?: string }; status: number } | { year: number; month: number } {
  const year = Number(body.year);
  const month = Number(body.month);
  if (!body.organization_id) return { error: { error: "organization_id_required" }, status: 400 };
  if (!Number.isInteger(year) || year < 2020 || year > 2100) {
    return { error: { error: "year_invalido", message: "year debe estar entre 2020 y 2100" }, status: 400 };
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return { error: { error: "month_invalido", message: "month debe estar entre 1 y 12" }, status: 400 };
  }
  return { year, month };
}

/**
 * Solicita el ZIP al PAC, espera a que termine de ensamblarlo y devuelve los
 * bytes. Separado del handler para mantener la complejidad acotada (EF-lint).
 */
async function generarZip(
  invoices: InvoicesZipApi,
  year: number,
  month: number,
): Promise<{ error: { error: string; message?: string; estado?: string }; status: number } | { bytes: ArrayBuffer }> {
  // 1. Solicitar el ZIP (idempotente: el PAC reutiliza una solicitud
  //    existente con los mismos criterios).
  const solicitud = await withFacturapiTimeout(
    "createZipRequest",
    invoices.createZipRequest({ year, month, issuer_type: "issuing", invoice_types: ["I", "E", "P"] }),
  );
  if (!solicitud?.id) {
    return {
      error: { error: "zip_sin_id", message: "FacturApi no devolvió el identificador de la solicitud ZIP." },
      status: 502,
    };
  }

  // 2. Esperar a que el PAC termine de ensamblar el paquete.
  let estado = solicitud.status ?? "pending";
  for (let intento = 0; intento < POLL_MAX_INTENTOS && estado !== "finished"; intento++) {
    await esperar(POLL_INTERVALO_MS);
    const actual = await withFacturapiTimeout("retrieveZipRequest", invoices.retrieveZipRequest(solicitud.id));
    estado = actual.status ?? estado;
  }
  if (estado !== "finished") {
    return {
      error: {
        error: "zip_no_listo",
        message: "FacturApi sigue generando el paquete. Espera un minuto y vuelve a intentar.",
        estado,
      },
      status: 409,
    };
  }

  // 3. Descargar el binario ya terminado.
  const binario = await withFacturapiTimeout("downloadZipRequest", invoices.downloadZipRequest(solicitud.id));
  return { bytes: await aArrayBuffer(binario) };
}

Deno.serve(wrapEdgeHandler("facturapi-descargar-zip", async (req) => {
  // EF-10: endpoints con JWT usan CORS de whitelist (guía _shared/cors.ts).
  const preflight = handlePreflightStrict(req);
  if (preflight) return preflight;
  const json = makeJson(req);
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "unauthorized" }, 401);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) return json({ error: "unauthorized" }, 401);

  const body = (await req.json().catch(() => ({}))) as ReqBody;
  const periodo = validarPeriodo(body);
  if ("error" in periodo) return json(periodo.error, periodo.status);

  // La descarga mensual es un paquete contable: se limita a roles de consulta
  // fiscal (admin/contador/tesorería/cobranza), no a operativos.
  const orgId = body.organization_id as string;
  if (!(await authorizeOrgRole(supabase, userData.user.id, orgId, ROLES_CONSULTA_FISCAL))) {
    return json({ error: "forbidden" }, 403);
  }

  // La llave se resuelve con cliente SERVICE_ROLE (sin el JWT del usuario):
  // RLS de `facturapi_credenciales` sólo permite leer a admin/contador. La
  // autorización del usuario ya se validó arriba.
  const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const resolved = await getFacturapiClient(
    adminClient as unknown as Parameters<typeof getFacturapiClient>[0],
    orgId,
  );
  if (!resolved.ok) {
    return json({ error: resolved.data.error, message: resolved.data.message }, resolved.data.status);
  }

  const invoices = (resolved.data.client as { invoices: InvoicesZipApi }).invoices;

  try {
    const zip = await generarZip(invoices, periodo.year, periodo.month);
    if ("error" in zip) return json(zip.error, zip.status);

    const mm = String(periodo.month).padStart(2, "0");
    return new Response(zip.bytes, {
      status: 200,
      headers: {
        ...buildCors(req),
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="cfdis-${periodo.year}-${mm}.zip"`,
        "Access-Control-Expose-Headers": "Content-Disposition",
        "Cache-Control": "private, max-age=0, no-store",
      },
    });
  } catch (err) {
    if (err instanceof FacturapiTimeoutError) {
      return json({ error: "timeout", message: err.message }, 504);
    }
    const { status, detail } = describeFacturapiError(err);
    return json({
      error: "facturapi_error",
      status,
      detail,
      message: extractFacturapiMessage(detail, status),
    }, 502);
  }
}));

