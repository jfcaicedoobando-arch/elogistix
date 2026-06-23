/**
 * auditoria-explicar-hallazgo — Explicación con IA de un hallazgo de auditoría.
 *
 * Recibe { embarque_id, regla, detalle } y devuelve un análisis estructurado
 * (qué significa, posibles causas — incluyendo backfill / datos legacy si
 * aplica — y pasos sugeridos). Usa Lovable AI Gateway con Gemini.
 *
 * Seguridad:
 *  - JWT obligatorio (evita drenaje de créditos por anónimos).
 *  - Valida que el usuario pertenezca a la organización del embarque (RLS
 *    implícito vía adminClient + verificación explícita).
 *  - No persiste resultados — pure proxy AI.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handlePreflightStrict, buildCors } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { authenticate } from "../_shared/auth.ts";
import { createLogger } from "../_shared/logger.ts";
import { initSentryEdge, captureEdgeException } from "../_shared/sentry.ts";
import {
  buildUserPrompt,
  mapGatewayStatus,
  type DocumentoCtx,
  type ContextoEmbarque,
} from "./helpers.ts";

initSentryEdge("auditoria-explicar-hallazgo");

// @ts-expect-error Deno global
const env = (k: string) => Deno.env.get(k);

const SYSTEM_PROMPT = `Eres un analista senior de operaciones de un freight forwarder mexicano (Libre Carga).
Recibirás un hallazgo de auditoría sobre un embarque y un resumen de su contexto real (facturas, proformas, conceptos, fechas y la lista REAL de documentos con su estado).

Tu trabajo:
1) Explicar en español MX qué significa el hallazgo (1-2 oraciones).
2) Listar 2-4 posibles causas concretas en BULLETS, basándote SIEMPRE en los datos del contexto:
   - Si la regla es \`docs_*\`, analiza la tabla de DOCUMENTOS primero. Identifica el documento concreto que dispara el hallazgo, revisa si hay duplicados (mismo nombre con distintos estados) y sé directo: "Es muy probable que sea un registro duplicado/legacy de '<nombre>' que quedó en Pendiente mientras otro idéntico ya está en No aplica/Recibido".
   - Si la regla es financiera o de facturación y el embarque ya tiene facturas pero los conceptos siguen en 'pendiente', menciona explícitamente que es un problema de BACKFILL de datos legacy.
   - No menciones backfill/facturación cuando la regla sea de documentos.
3) Sugerir 2-3 pasos concretos en BULLETS, alineados con la regla (ej. "Eliminar el registro duplicado de 'Certificado de Origen' en Pendiente", "Marcar como revisado con nota", "Ejecutar backfill desde /admin/auditoria").

Máximo 220 palabras totales. No inventes datos que no estén en el contexto. Usa formato markdown simple (## títulos, - bullets).`;


async function buildContexto(adminClient: ReturnType<typeof authenticate> extends Promise<infer T> ? (T extends { adminClient: infer C } ? C : never) : never, embarqueId: string): Promise<ContextoEmbarque | null> {
  // @ts-expect-error supabase chain
  const { data: e } = await adminClient
    .from("embarques")
    .select("expediente, estado, modo, cliente_nombre, etd, eta, fecha_llegada_real")
    .eq("id", embarqueId)
    .maybeSingle();
  if (!e) return null;

  // @ts-expect-error supabase chain
  const [{ data: cv }, { data: cc }, { data: facturas }, { data: proformas }, { data: docs }] = await Promise.all([
    adminClient.from("conceptos_venta").select("id, estado_facturacion").eq("embarque_id", embarqueId),
    adminClient.from("conceptos_costo").select("id").eq("embarque_id", embarqueId),
    adminClient.from("facturas").select("numero, estado, total, moneda").eq("embarque_id", embarqueId).limit(10),
    adminClient.from("proformas").select("folio, estado").eq("embarque_id", embarqueId).limit(10),
    adminClient.from("documentos_embarque").select("nombre, estado, archivo").eq("embarque_id", embarqueId).is("deleted_at", null).limit(40),
  ]);

  const cvList = (cv ?? []) as Array<{ estado_facturacion: string }>;
  const docList: DocumentoCtx[] = ((docs ?? []) as Array<{ nombre: string; estado: string; archivo: string | null }>).map((d) => ({
    nombre: d.nombre,
    estado: d.estado,
    tiene_archivo: Boolean(d.archivo),
  }));
  return {
    expediente: e.expediente,
    estado: e.estado,
    modo: e.modo,
    cliente: e.cliente_nombre ?? "—",
    etd: e.etd,
    eta: e.eta,
    fecha_llegada_real: e.fecha_llegada_real,
    conceptos_venta_total: cvList.length,
    conceptos_venta_pendientes: cvList.filter((c) => c.estado_facturacion === "pendiente").length,
    conceptos_venta_facturados: cvList.filter((c) => c.estado_facturacion === "facturado").length,
    conceptos_costo_total: (cc ?? []).length,
    facturas: ((facturas ?? []) as Array<{ numero: string; estado: string; total: number; moneda: string }>).map((f) => ({
      folio: f.numero, estado: f.estado, total: Number(f.total ?? 0), moneda: f.moneda ?? "MXN",
    })),
    proformas: ((proformas ?? []) as Array<{ folio: string; estado: string }>).map((p) => ({ folio: p.folio, estado: p.estado })),
    documentos: docList,
  };
}

async function callGateway(apiKey: string, userPrompt: string): Promise<Response> {
  return await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    }),
  });
}

function handleGatewayError(status: number, log: ReturnType<typeof createLogger>, cors: HeadersInit) {
  const { status: mappedStatus, message } = mapGatewayStatus(status);
  if (mappedStatus === 500) log.error("AI gateway error", { status_code: status });
  return errorResponse(message, mappedStatus, cors);
}

async function authorizeEmbarque(
  adminClient: ReturnType<typeof authenticate> extends Promise<infer A> ? (A extends { adminClient: infer C } ? C : never) : never,
  userId: string,
  embarqueId: string,
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  // @ts-expect-error supabase chain
  const { data: emb } = await adminClient
    .from("embarques").select("organization_id").eq("id", embarqueId).maybeSingle();
  if (!emb?.organization_id) return { ok: false, status: 404, message: "Embarque no encontrado" };

  // @ts-expect-error supabase chain
  const { data: membership } = await adminClient
    .from("organization_members").select("organization_id")
    .eq("user_id", userId).eq("organization_id", emb.organization_id).maybeSingle();
  if (membership) return { ok: true };

  // @ts-expect-error supabase chain
  const { data: superRole } = await adminClient
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "super_admin").maybeSingle();
  if (superRole) return { ok: true };

  return { ok: false, status: 403, message: "No autorizado para este embarque" };
}


async function invocarGateway(
  ctx: Awaited<ReturnType<typeof buildContexto>>,
  regla: string,
  detalle: string,
  log: ReturnType<typeof createLogger>,
  cors: HeadersInit,
): Promise<{ ok: true; content: string } | { ok: false; response: Response }> {
  const apiKey = env("LOVABLE_API_KEY");
  if (!apiKey) {
    log.error("LOVABLE_API_KEY missing", { status_code: 500 });
    return { ok: false, response: errorResponse("Configuración de IA no disponible", 500, cors) };
  }
  const resp = await callGateway(apiKey, buildUserPrompt(regla, detalle, ctx));
  if (!resp.ok) return { ok: false, response: handleGatewayError(resp.status, log, cors) };
  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content ?? "";
  if (!content) return { ok: false, response: errorResponse("Respuesta IA vacía", 422, cors) };
  return { ok: true, content };
}

async function processRequest(req: Request, cors: HeadersInit, log: ReturnType<typeof createLogger>): Promise<Response> {
  const auth = await authenticate(req, log);
  const body = await req.json().catch(() => null) as { embarque_id?: string; regla?: string; detalle?: string } | null;
  if (!body?.embarque_id || !body?.regla || !body?.detalle) {
    return errorResponse("embarque_id, regla y detalle son requeridos", 400, cors);
  }

  const authz = await authorizeEmbarque(auth.adminClient, auth.userId, body.embarque_id);
  if (!authz.ok) return errorResponse(authz.message, authz.status, cors);

  const ctx = await buildContexto(auth.adminClient, body.embarque_id);
  if (!ctx) return errorResponse("No se pudo cargar el contexto", 404, cors);

  const result = await invocarGateway(ctx, body.regla, body.detalle, log, cors);
  if (!result.ok) return result.response;

  log.finish(200, "hallazgo explicado");
  return jsonResponse({ explicacion: result.content, modelo: "google/gemini-3-flash-preview" }, 200, cors);
}



serve(async (req) => {
  const preflight = handlePreflightStrict(req);
  if (preflight) return preflight;
  const cors = buildCors(req);
  const log = createLogger(req, "auditoria-explicar-hallazgo");
  try {
    return await processRequest(req, cors, log);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    const [code, ...rest] = message.split(":");
    const status = /^\d+$/.test(code) ? parseInt(code) : 500;
    log.error("auditoria-explicar-hallazgo falló", { status_code: status, payload: { error: message } });
    // 13.114.19: capturar también 4xx inesperados (antes sólo >=500).
    if (status >= 400) await captureEdgeException(error, { fn: "auditoria-explicar-hallazgo", status_code: status });
    return errorResponse(rest.join(":") || message, status, cors);
  }
});
