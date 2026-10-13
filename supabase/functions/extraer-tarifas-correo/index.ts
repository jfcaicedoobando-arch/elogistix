/**
 * extraer-tarifas-correo — Lee el buzón de Pricing (Gmail) y devuelve el
 * contenido de los correos de tarifas de los 4 agentes (Longsail, Golden,
 * Oriental, Rainbow) para que el frontend los convierta en tarifas borrador.
 *
 * Sólo LEE correos (gmail.readonly). El parseo y la validación contra los
 * catálogos ocurren en el frontend; aquí se devuelve el texto plano del
 * correo más reciente de cada proveedor y, si trae un Excel de tarifas,
 * su contenido en base64.
 *
 * Seguridad: JWT válido + membresía de org + rol de pricing
 * (ROLES_PRICING_TARIFARIO, espejo de `esRolPricing`). Las credenciales del
 * conector de Gmail viven sólo en el servidor.
 */
import { buildCors, handlePreflightStrict } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/response.ts";
import {
  authenticate,
  authorizeOrgRole,
  ROLES_PRICING_TARIFARIO,
} from "../_shared/auth.ts";
import { createLogger, type Logger } from "../_shared/logger.ts";
import {
  captureEdgeException,
  debeReportarStatus,
  wrapEdgeHandler,
} from "../_shared/sentry.ts";

const GW = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";
const DIAS_BUSQUEDA = 20;

const PROVEEDORES = [
  { id: "longsail", dominio: "longsailing.net" },
  { id: "golden", dominio: "szgolden-shipping.com" },
  { id: "oriental", dominio: "oriental-log.com" },
  { id: "rainbow", dominio: "rainbowell.com" },
] as const;

interface Parte {
  mimeType?: string;
  filename?: string;
  body?: { data?: string; attachmentId?: string };
  parts?: Parte[];
}

export interface CorreoProveedor {
  proveedor: string;
  asunto: string;
  fecha: string;
  textoPlano: string;
  xlsxBase64: string | null;
  xlsxNombre: string | null;
  error?: string;
}

const b64urlATexto = (data: string): string => {
  const bin = atob(data.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
};

async function gmailGet(
  path: string,
  headers: Record<string, string>,
): Promise<unknown> {
  const res = await fetch(`${GW}${path}`, { headers });
  if (!res.ok) {
    const cuerpo = await res.text();
    throw new Error(`${res.status}:Gmail respondió ${res.status}: ${cuerpo.slice(0, 300)}`);
  }
  return res.json();
}

function recolectar(parte: Parte, textos: string[], adjuntos: Parte[]): void {
  if (parte.mimeType === "text/plain" && parte.body?.data) {
    textos.push(b64urlATexto(parte.body.data));
  }
  if (parte.filename?.toLowerCase().endsWith(".xlsx") && parte.body?.attachmentId) {
    adjuntos.push(parte);
  }
  for (const p of parte.parts ?? []) recolectar(p, textos, adjuntos);
}

async function leerCorreoProveedor(
  proveedor: (typeof PROVEEDORES)[number],
  headers: Record<string, string>,
): Promise<CorreoProveedor> {
  const base: CorreoProveedor = {
    proveedor: proveedor.id, asunto: "", fecha: "",
    textoPlano: "", xlsxBase64: null, xlsxNombre: null,
  };
  const lista = await gmailGet(
    `/users/me/messages?q=${encodeURIComponent(`from:${proveedor.dominio} newer_than:${DIAS_BUSQUEDA}d`)}&maxResults=1`,
    headers,
  ) as { messages?: { id: string }[] };
  const id = lista.messages?.[0]?.id;
  if (!id) return { ...base, error: "Sin correos recientes de este proveedor" };

  const msg = await gmailGet(`/users/me/messages/${id}?format=full`, headers) as {
    payload: Parte & { headers?: { name: string; value: string }[] };
  };
  const cab = (n: string) =>
    msg.payload.headers?.find((h) => h.name.toLowerCase() === n.toLowerCase())?.value ?? "";
  const textos: string[] = [];
  const adjuntos: Parte[] = [];
  recolectar(msg.payload, textos, adjuntos);

  let xlsxBase64: string | null = null;
  let xlsxNombre: string | null = null;
  const adj = adjuntos[0];
  if (adj?.body?.attachmentId) {
    const data = await gmailGet(
      `/users/me/messages/${id}/attachments/${adj.body.attachmentId}`,
      headers,
    ) as { data?: string };
    xlsxBase64 = data.data ?? null;
    xlsxNombre = adj.filename ?? null;
  }
  return {
    ...base,
    asunto: cab("Subject"),
    fecha: cab("Date"),
    textoPlano: textos.join("\n"),
    xlsxBase64,
    xlsxNombre,
  };
}

async function handle(
  req: Request,
  cors: Record<string, string>,
  log: Logger,
): Promise<Response> {
  const auth = await authenticate(req, log);
  const { organizationId } = (await req.json().catch(() => ({}))) as { organizationId?: string };
  if (!organizationId) return errorResponse("Falta la organización", 400, cors);
  const autorizado = await authorizeOrgRole(
    auth.adminClient, auth.userId, organizationId, ROLES_PRICING_TARIFARIO,
  );
  if (!autorizado) return errorResponse("No tienes permiso para extraer tarifas del correo", 403, cors);

  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const gmailKey = Deno.env.get("GOOGLE_MAIL_API_KEY");
  if (!lovableKey || !gmailKey) {
    return errorResponse("La conexión de Gmail no está configurada en el servidor", 500, cors);
  }
  const headers = {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": gmailKey,
  };

  const correos: CorreoProveedor[] = [];
  for (const p of PROVEEDORES) {
    try {
      correos.push(await leerCorreoProveedor(p, headers));
    } catch (e) {
      const detalle = e instanceof Error ? e.message : String(e);
      log.warn("correo_proveedor_fallo", { payload: { proveedor: p.id, detalle } });
      correos.push({
        proveedor: p.id, asunto: "", fecha: "", textoPlano: "",
        xlsxBase64: null, xlsxNombre: null,
        error: `No se pudo leer el correo: ${detalle.replace(/^\d+:/, "")}`,
      });
    }
  }
  log.finish(200, "correos de tarifas leídos", {
    payload: { proveedores: correos.length, con_error: correos.filter((c) => c.error).length },
  });
  return jsonResponse({ correos }, 200, cors);
}

Deno.serve(wrapEdgeHandler("extraer-tarifas-correo", async (req) => {
  const preflight = handlePreflightStrict(req);
  if (preflight) return preflight;
  const cors = buildCors(req);
  const log = createLogger(req, "extraer-tarifas-correo");
  try {
    return await handle(req, cors, log);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error desconocido";
    const [code, ...rest] = message.split(":");
    const status = /^\d+$/.test(code) ? parseInt(code) : 500;
    log.error("extraer-tarifas-correo falló", { status_code: status, payload: { error: message } });
    if (debeReportarStatus(status)) {
      await captureEdgeException(e, { fn: "extraer-tarifas-correo", status_code: status });
    }
    return errorResponse(rest.join(":") || message, status, cors);
  }
}));
