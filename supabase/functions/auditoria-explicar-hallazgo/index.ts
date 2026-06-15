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

initSentryEdge("auditoria-explicar-hallazgo");

// @ts-expect-error Deno global
const env = (k: string) => Deno.env.get(k);

const SYSTEM_PROMPT = `Eres un analista senior de operaciones de un freight forwarder mexicano (Libre Carga).
Recibirás un hallazgo de auditoría sobre un embarque y un resumen de su contexto real (facturas, proformas, conceptos, fechas).

Tu trabajo:
1) Explicar en español MX qué significa el hallazgo (1-2 oraciones).
2) Listar 2-4 posibles causas concretas en BULLETS. Considera SIEMPRE como hipótesis si los datos del contexto contradicen el hallazgo (ej. el embarque sí tiene facturas pero los conceptos_venta siguen en 'pendiente'), lo cual indica un problema de BACKFILL de datos legacy (embarques creados antes de que existiera el módulo de facturación). Sé directo: "Es muy probable que sea backfill" cuando aplique.
3) Sugerir 2-3 pasos concretos en BULLETS (ej. "Ejecutar backfill desde /admin/auditoria", "Marcar como revisado con nota", "Re-facturar concepto X").

Máximo 200 palabras totales. No inventes datos que no estén en el contexto. Usa formato markdown simple (## títulos, - bullets).`;

interface ContextoEmbarque {
  expediente: string;
  estado: string;
  modo: string;
  cliente: string;
  etd: string | null;
  eta: string | null;
  fecha_llegada_real: string | null;
  conceptos_venta_total: number;
  conceptos_venta_pendientes: number;
  conceptos_venta_facturados: number;
  conceptos_costo_total: number;
  facturas: Array<{ folio: string; estado: string; total: number; moneda: string }>;
  proformas: Array<{ folio: string; estado: string }>;
  documentos_count: number;
}

async function buildContexto(adminClient: ReturnType<typeof authenticate> extends Promise<infer T> ? (T extends { adminClient: infer C } ? C : never) : never, embarqueId: string): Promise<ContextoEmbarque | null> {
  // @ts-expect-error supabase chain
  const { data: e } = await adminClient
    .from("embarques")
    .select("expediente, estado, modo, cliente_nombre, etd, eta, fecha_llegada_real")
    .eq("id", embarqueId)
    .maybeSingle();
  if (!e) return null;

  // @ts-expect-error supabase chain
  const [{ data: cv }, { data: cc }, { data: facturas }, { data: proformas }, { count: docCount }] = await Promise.all([
    adminClient.from("conceptos_venta").select("id, estado_facturacion").eq("embarque_id", embarqueId),
    adminClient.from("conceptos_costo").select("id").eq("embarque_id", embarqueId),
    adminClient.from("facturas").select("numero, estado, total, moneda").eq("embarque_id", embarqueId).limit(10),
    adminClient.from("proformas").select("folio, estado").eq("embarque_id", embarqueId).limit(10),
    adminClient.from("documentos_embarque").select("id", { count: "exact", head: true }).eq("embarque_id", embarqueId),
  ]);

  const cvList = (cv ?? []) as Array<{ estado_facturacion: string }>;
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
    documentos_count: docCount ?? 0,
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
  if (status === 429) return errorResponse("Límite de solicitudes excedido, intenta en unos momentos.", 429, cors);
  if (status === 402) return errorResponse("Créditos insuficientes para procesamiento AI.", 402, cors);
  log.error("AI gateway error", { status_code: status });
  return errorResponse("Error al generar la explicación", 500, cors);
}

async function processRequest(req: Request, cors: HeadersInit, log: ReturnType<typeof createLogger>): Promise<Response> {
  const auth = await authenticate(req, log);
  const body = await req.json().catch(() => null) as { embarque_id?: string; regla?: string; detalle?: string } | null;
  if (!body?.embarque_id || !body?.regla || !body?.detalle) {
    return errorResponse("embarque_id, regla y detalle son requeridos", 400, cors);
  }

  // Verifica que el embarque pertenece a una org del usuario
  // @ts-expect-error supabase chain
  const { data: emb } = await auth.adminClient
    .from("embarques")
    .select("organization_id")
    .eq("id", body.embarque_id)
    .maybeSingle();
  if (!emb?.organization_id) return errorResponse("Embarque no encontrado", 404, cors);

  // @ts-expect-error supabase chain
  const { data: membership } = await auth.adminClient
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", auth.userId)
    .eq("organization_id", emb.organization_id)
    .maybeSingle();
  // super_admin bypass
  // @ts-expect-error supabase chain
  const { data: superRole } = await auth.adminClient
    .from("user_roles").select("role").eq("user_id", auth.userId).eq("role", "super_admin").maybeSingle();
  if (!membership && !superRole) return errorResponse("No autorizado para este embarque", 403, cors);

  const ctx = await buildContexto(auth.adminClient, body.embarque_id);
  if (!ctx) return errorResponse("No se pudo cargar el contexto", 404, cors);

  const apiKey = env("LOVABLE_API_KEY");
  if (!apiKey) {
    log.error("LOVABLE_API_KEY missing", { status_code: 500 });
    return errorResponse("Configuración de IA no disponible", 500, cors);
  }

  const userPrompt = [
    `**Hallazgo**`,
    `Regla: ${body.regla}`,
    `Detalle: ${body.detalle}`,
    ``,
    `**Contexto real del embarque**`,
    `Expediente: ${ctx.expediente} | Estado: ${ctx.estado} | Modo: ${ctx.modo}`,
    `Cliente: ${ctx.cliente}`,
    `ETD: ${ctx.etd ?? "—"} | ETA: ${ctx.eta ?? "—"} | Llegada real: ${ctx.fecha_llegada_real ?? "—"}`,
    `Conceptos venta: ${ctx.conceptos_venta_total} (pendientes: ${ctx.conceptos_venta_pendientes}, facturados: ${ctx.conceptos_venta_facturados})`,
    `Conceptos costo: ${ctx.conceptos_costo_total}`,
    `Documentos: ${ctx.documentos_count}`,
    `Facturas (${ctx.facturas.length}): ${ctx.facturas.map((f) => `${f.folio} [${f.estado}] ${f.total} ${f.moneda}`).join("; ") || "—"}`,
    `Proformas (${ctx.proformas.length}): ${ctx.proformas.map((p) => `${p.folio} [${p.estado}]`).join("; ") || "—"}`,
  ].join("\n");

  const resp = await callGateway(apiKey, userPrompt);
  if (!resp.ok) return handleGatewayError(resp.status, log, cors);

  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content ?? "";
  if (!content) return errorResponse("Respuesta IA vacía", 422, cors);

  log.finish(200, "hallazgo explicado");
  return jsonResponse({ explicacion: content, modelo: "google/gemini-3-flash-preview" }, 200, cors);
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
    if (status >= 500) await captureEdgeException(error, { fn: "auditoria-explicar-hallazgo", status_code: status });
    return errorResponse(rest.join(":") || message, status, cors);
  }
});
