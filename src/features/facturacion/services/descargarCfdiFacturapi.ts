/**
 * Descarga PDF/XML de un CFDI (factura o REP) llamando a la edge function
 * `facturapi-descargar`. Devuelve un Blob listo para guardar en disco.
 *
 * Las URLs almacenadas en `factura_pdf_url|xml_url` y `rep_pdf_url|xml_url`
 * apuntan a FacturApi y requieren la API key de la organización; por eso no
 * se pueden abrir directamente desde el navegador y necesitan este proxy.
 */
import { ensureFreshSession } from "@/lib/auth/ensureFreshSession";
import { DescargaCfdiError } from "@/features/facturacion/domain/descargaCfdiError";
import { supabase } from "@/integrations/supabase/client";
import { AuthOperationChangedError, captureAuthOperationScope } from "@/lib/auth/authOperationScope";

export type CfdiTipo = "pdf" | "xml";

export interface DescargarCfdiOpts {
  tipo: CfdiTipo;
  facturaId?: string;
  pagoId?: string;
  notaCreditoId?: string;
}

/** Detecta si la URL guardada apunta a FacturApi (necesita proxy). */
export function esUrlFacturapi(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.includes("facturapi.io");
}

export interface CfdiBlob {
  blob: Blob;
  filename: string;
}

async function errorRespuesta(res: Response): Promise<DescargaCfdiError> {
  let code = "descarga_cfdi";
  let message = `Error ${res.status}`;
  try {
    const payload: unknown = await res.json();
    if (payload && typeof payload === "object") {
      if ("error" in payload && typeof payload.error === "string") code = payload.error;
      if ("message" in payload && typeof payload.message === "string") message = payload.message;
      else if (code !== "descarga_cfdi") message = code;
    }
  } catch { /* respuesta no-JSON: conservar el status */ }
  return new DescargaCfdiError(message, res.status, code, res.headers?.get("x-request-id") ?? undefined);
}

function solicitarArchivo(opts: DescargarCfdiOpts, token: string): Promise<Response> {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  if (!baseUrl || !key) throw new DescargaCfdiError("El servicio de descarga no está configurado. Contacta a soporte.", 503, "configuracion_descarga");
  return fetch(`${baseUrl.replace(/\/$/, "")}/functions/v1/facturapi-descargar`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, apikey: key },
    body: JSON.stringify({ tipo: opts.tipo, factura_id: opts.facturaId, pago_id: opts.pagoId, nota_credito_id: opts.notaCreditoId }),
  });
}

async function usuarioSesion(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user.id ?? null;
}

async function validarUsuarioSesion(userId: string | null, token: string | null): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if ((session?.user.id ?? null) !== userId || (token && session?.access_token !== token)) {
    throw new AuthOperationChangedError();
  }
}

export async function fetchCfdiFacturapi(opts: DescargarCfdiOpts): Promise<CfdiBlob> {
  if (!opts.facturaId && !opts.pagoId && !opts.notaCreditoId) {
    throw new Error("facturaId, pagoId o notaCreditoId requerido");
  }
  const scope = captureAuthOperationScope();
  const userId = await usuarioSesion();
  scope.assertCurrent();
  const token = await ensureFreshSession();
  await validarUsuarioSesion(userId, token);
  scope.assertCurrent();
  if (!token) throw new DescargaCfdiError("Se requiere una sesión válida para descargar el comprobante.", 401, "unauthorized");
  let res = await solicitarArchivo(opts, token);
  scope.assertCurrent();
  let originalRequestId: string | undefined;
  // Lectura idempotente: sólo un 401 permite recuperar una credencial distinta.
  // No implica que la causa del rechazo observado fuese una sesión expirada.
  if (res.status === 401) {
    const rechazado = await errorRespuesta(res);
    scope.assertCurrent();
    originalRequestId = rechazado.requestId;
    const recuperado = await ensureFreshSession(true, token);
    await validarUsuarioSesion(userId, recuperado);
    scope.assertCurrent();
    if (!recuperado || recuperado === token) throw rechazado;
    res = await solicitarArchivo(opts, recuperado);
    scope.assertCurrent();
  }
  if (!res.ok) {
    const fallo = await errorRespuesta(res);
    scope.assertCurrent();
    throw new DescargaCfdiError(fallo.message, fallo.status, fallo.code, fallo.requestId, originalRequestId);
  }

  const blob = await res.blob();
  await validarUsuarioSesion(userId, null);
  scope.assertCurrent();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = /filename="?([^"]+)"?/i.exec(disposition);
  const filename = match?.[1] ?? `cfdi.${opts.tipo}`;
  return { blob, filename };
}

export async function descargarCfdiFacturapi(opts: DescargarCfdiOpts): Promise<void> {
  const scope = captureAuthOperationScope();
  const { blob, filename } = await fetchCfdiFacturapi(opts);
  scope.assertCurrent();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
