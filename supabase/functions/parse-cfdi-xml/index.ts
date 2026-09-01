/**
 * parse-cfdi-xml — Parsea un XML CFDI 4.0 mexicano y sugiere categoría via AI.
 *
 * Seguridad:
 *  - Requiere JWT válido + membresía de organización + rol de captura CxP y
 *    rate limit persistente (Ola P2, `_shared/cxpGuard.ts`): antes cualquier
 *    sesión autenticada — incluidos portal cliente y la cuenta demo — podía
 *    consumir la cuota de IA del servidor.
 *  - Rechaza no-XML, >2 MB (corte temprano por Content-Length), DOCTYPE (XXE),
 *    o CFDI != 4.0.
 *  - El string crudo de `categorias` tiene tope explícito ANTES de JSON.parse.
 *  - El parser es regex puro, sin DOM. La AI sólo recibe descripciones de
 *    conceptos + nombres de categorías para sugerir matcheo.
 */
import { buildCors, handlePreflightStrict } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/response.ts";
import { authenticate } from "../_shared/auth.ts";
import { autorizarCxp, leerOrgHeader } from "../_shared/cxpGuard.ts";
import { createLogger } from "../_shared/logger.ts";
import {
  captureEdgeException,
  debeReportarStatus,
  wrapEdgeHandler,
} from "../_shared/sentry.ts";
import { parseCfdi } from "../_shared/cfdiParser.ts";
import { type Categoria, parseCategoriasJson } from "./aiHelpers.ts";
import {
  type AiCallResult,
  sugerirCategoria,
} from "./sugerirCategoria.ts";

// 13.114.5: `wrapEdgeHandler` reemplaza `initSentryEdge` + try/catch manual
// para que excepciones no controladas (cold start, CPU wall-limit) lleguen
// también a Sentry server-side, no sólo el "Failed to fetch" del browser.

const MAX_BYTES = 2 * 1024 * 1024;
/** Margen para el overhead del multipart (boundary + headers de la parte). */
const MAX_CONTENT_LENGTH = MAX_BYTES + 256 * 1024;
/**
 * Tope del string crudo de `categorias` ANTES de JSON.parse: 50 categorías
 * (el recorte que ya aplica `parseCategoriasJson`) con UUID + nombre largo
 * caben de sobra en 32 KiB.
 */
export const MAX_CATEGORIAS_CHARS = 32 * 1024;
/** Topes de uso de IA por usuario y por organización (ventana de 1 h). */
const RL_USUARIO = { windowSeconds: 3600, max: 40 } as const;
const RL_ORG = { windowSeconds: 3600, max: 200 } as const;

/**
 * Ola P2 · valida tamaño, tipo y catálogo del multipart antes de parsear.
 * Devuelve el archivo o la respuesta de error ya lista.
 */
async function validarEntrada(
  req: Request,
  cors: Record<string, string>,
): Promise<
  | {
    ok: true;
    file: File;
    categoriasJson: string | null;
  }
  | { ok: false; res: Response }
> {
  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_CONTENT_LENGTH) {
    return { ok: false, res: errorResponse("El XML excede 2 MB", 413, cors) };
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return {
      ok: false,
      res: errorResponse("No se pudo leer el archivo enviado", 400, cors),
    };
  }
  const file = form.get("file") as File | null;
  const categoriasJson = form.get("categorias") as string | null;

  if (!file) {
    return { ok: false, res: errorResponse("Falta archivo XML", 400, cors) };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, res: errorResponse("El XML excede 2 MB", 413, cors) };
  }
  const isXml = file.type.includes("xml") ||
    file.name.toLowerCase().endsWith(".xml");
  if (!isXml) {
    return {
      ok: false,
      res: errorResponse("Solo se aceptan archivos XML", 400, cors),
    };
  }

  if (categoriasJson && categoriasJson.length > MAX_CATEGORIAS_CHARS) {
    return {
      ok: false,
      res: errorResponse(
        "El catálogo de categorías enviado es demasiado grande",
        413,
        cors,
      ),
    };
  }
  return { ok: true, file, categoriasJson };
}

async function handle(
  req: Request,
  cors: Record<string, string>,
  log: ReturnType<typeof createLogger>,
) {
  const auth = await authenticate(req, log);
  // La autorización corre ANTES de tocar el body: así un usuario autenticado
  // sin rol no puede forzar la materialización del multipart.
  const autorizacion = await autorizarCxp(auth, cors, log, {
    organizationId: leerOrgHeader(req),
    fn: "parse-cfdi-xml",
    rlUsuario: RL_USUARIO,
    rlOrg: RL_ORG,
    mensaje429: "Demasiadas solicitudes de parseo de XML. Intenta más tarde.",
  });
  if (!autorizacion.ok) return autorizacion.res;

  const entrada = await validarEntrada(req, cors);
  if (!entrada.ok) return entrada.res;

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  const { file, categoriasJson } = entrada;

  const text = await file.text();
  let cfdi;
  try {
    cfdi = parseCfdi(text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "XML inválido";
    return errorResponse(msg, 400, cors);
  }

  const categorias: Categoria[] = parseCategoriasJson(categoriasJson);

  let aiResult: AiCallResult;
  if (LOVABLE_API_KEY) {
    aiResult = await sugerirCategoria(
      LOVABLE_API_KEY,
      cfdi.conceptos,
      categorias,
      log,
    );
  } else {
    aiResult = {
      result: {
        categoria_id: null,
        notas: cfdi.conceptos[0]?.descripcion?.slice(0, 200) ?? "",
      },
      outcome: "skipped",
      latency_ms: 0,
      status_code: null,
    };
  }

  log.finish(200, "cfdi parseado", {
    payload: {
      ai_outcome: aiResult.outcome,
      ai_latency_ms: aiResult.latency_ms,
    },
  });
  return jsonResponse({ cfdi, ai: aiResult.result }, 200, cors);
}

Deno.serve(wrapEdgeHandler("parse-cfdi-xml", async (req) => {
  const preflight = handlePreflightStrict(req);
  if (preflight) return preflight;
  const cors = buildCors(req);
  const log = createLogger(req, "parse-cfdi-xml");
  try {
    return await handle(req, cors, log);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error desconocido";
    const [code, ...rest] = message.split(":");
    const status = /^\d+$/.test(code) ? parseInt(code) : 500;
    log.error("parse-cfdi-xml falló", {
      status_code: status,
      payload: { error: message },
    });
    // 13.114.20: capturar también 4xx inesperados (consistente con
    // user-management / auditoria-explicar-hallazgo desde 13.114.19).
    if (debeReportarStatus(status)) {
      await captureEdgeException(e, {
        fn: "parse-cfdi-xml",
        status_code: status,
      });
    }
    return errorResponse(rest.join(":") || message, status, cors);
  }
}));
