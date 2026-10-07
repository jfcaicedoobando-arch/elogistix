/**
 * Servicio: envío de cotización por correo.
 *
 * Flujo:
 *  1. `prepare` → obtiene signed upload URL para el PDF.
 *  2. Genera el PDF como blob en cliente con la plantilla existente.
 *  3. Sube el PDF al bucket privado vía signed upload URL.
 *  4. `send` → invoca la edge function que dispara los correos y registra el envío.
 *
 * Nota (13.68.6): se usa `fetch` directo en vez de `supabase.functions.invoke()`
 * para enviar `Authorization` + `apikey` explícitos y leer el cuerpo del error.
 * Antes, cuando la edge function devolvía un error, el cliente sólo veía
 * "Failed to send a request to the Edge Function" sin la causa real.
 */
import { supabase } from "@/integrations/supabase/client";
import type { CotizacionRow } from "@/features/cotizacion/types";
import { TASA_IVA } from "@/lib/financial/financialUtils";
import { fetchConReintento, OFFLINE_MSG } from "./_networkRetry";
import { captureAuthOperationScope } from "@/lib/auth/authOperationScope";

export { fetchConReintento, OFFLINE_MSG };

export interface DestinatarioEnvio {
  email: string;
  nombre?: string;
  contacto_id?: string;
}

export interface EnviarEmailInput {
  cotizacion: CotizacionRow;
  destinatarios: DestinatarioEnvio[];
  cc: string[];
  mensaje: string;
  asunto: string;
  marcarEnviada: boolean;
  totales: { mxn?: string; usd?: string };
  /**
   * R2 · W-04: ya NO se envía al servidor (la edge function lo toma de la
   * sesión). Se conserva sólo para la vista previa del correo en el cliente.
   */
  ejecutivo?: { nombre?: string; email?: string; telefono?: string };

  tasaIva?: number;
}

export interface EnviarEmailResult {
  success: boolean;
  estado: "enviado" | "parcial" | "fallido";
  envio_id: string | null;
  resultados: Array<{ email: string; tipo: string; ok: boolean; error?: string }>;
  pdf_link: string;
  /** R2 · W-03: el link firmado del PDF caduca (TTL 7 días). */
  pdf_link_expires_at?: string;
}


const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const ENVIAR_URL = `${SUPABASE_URL}/functions/v1/enviar-cotizacion-email`;
const NETWORK_HINT =
  "Revisa tu conexión, VPN o antivirus/firewall corporativo e intenta de nuevo.";


async function invokeEnviarCotizacion<T = unknown>(body: Record<string, unknown>, scope: ReturnType<typeof captureAuthOperationScope>): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  scope.assertCurrent();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    throw new Error("Tu sesión expiró. Vuelve a iniciar sesión e intenta de nuevo.");
  }

  let resp: Response;
  try {
    resp = await fetchConReintento(ENVIAR_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(body),
    }, scope.assertCurrent);
  } catch (e) {
    scope.assertCurrent();
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === OFFLINE_MSG) throw Object.assign(new Error(OFFLINE_MSG), { cause: e });
    throw Object.assign(new Error(`No se pudo contactar al servicio de correo: ${msg}. ${NETWORK_HINT}`), { cause: e });
  }


  const raw = await resp.text();
  scope.assertCurrent();
  let parsed: unknown = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    // respuesta no-JSON; conservamos `raw` para el mensaje
  }

  if (!resp.ok) {
    const detalle =
      (parsed && typeof parsed === "object" && "error" in parsed
        ? String((parsed as { error: unknown }).error)
        : raw) || `HTTP ${resp.status}`;
    throw new Error(`Servicio de correo (${resp.status}): ${detalle}`);
  }

  return (parsed ?? {}) as T;
}

interface PrepareResponse {
  upload_url?: string;
  upload_token?: string;
  path?: string;
  error?: string;
}

async function generarPdfBlob(cotizacion: CotizacionRow, tasaIva: number): Promise<Blob> {
  const scope = captureAuthOperationScope();
  // Reusa la misma plantilla que el botón "Exportar PDF".
  const [{ CotizacionDocument }, { cargarEmisorDocumento }, { pdf }, { createElement }] = await Promise.all([
    import("@/pdf/documents/CotizacionDocument"),
    import("@/pdf/emisor"),
    import("@react-pdf/renderer"),
    import("react"),
  ]);
  scope.assertCurrent();
  const emisor = await cargarEmisorDocumento(cotizacion.organization_id);
  scope.assertCurrent();
  // SAFE-CAST: CotizacionDocument devuelve un DocumentElement de react-pdf; el genérico de createElement no lo infiere.
  const element = createElement(CotizacionDocument, { cotizacion, tasaIva, emisor }) as Parameters<typeof pdf>[0];
  const instance = pdf(element);

  const blob = await instance.toBlob();
  scope.assertCurrent();
  return blob;
}


export async function enviarCotizacionPorEmail(input: EnviarEmailInput): Promise<EnviarEmailResult> {
  const scope = captureAuthOperationScope();
  const { cotizacion, tasaIva = TASA_IVA } = input;
  if (!cotizacion.organization_id || cotizacion.organization_id !== scope.organizationId) {
    throw new Error("La organización del documento no coincide con la organización activa.");
  }

  // 1. prepare → signed upload URL
  const prep = await invokeEnviarCotizacion<PrepareResponse>({
    action: "prepare",
    cotizacion_id: cotizacion.id,
  }, scope);
  scope.assertCurrent();
  if (!prep?.upload_token || !prep?.path) {
    throw new Error(prep?.error ?? "No se pudo preparar la subida del PDF");
  }

  // 2. Generar PDF
  const blob = await generarPdfBlob(cotizacion, tasaIva);
  scope.assertCurrent();

  // 3. Subir con signed upload URL
  const { error: uploadErr } = await supabase
    .storage.from("cotizaciones-pdf")
    .uploadToSignedUrl(prep.path, prep.upload_token, blob, { contentType: "application/pdf" });
  if (uploadErr) throw new Error(`Subida de PDF falló: ${uploadErr.message}`);
  scope.assertCurrent();

  // 4. send
  // R2 · W-02/W-04: `pdf_path` y `ejecutivo` ya NO se envían; el servidor
  // resuelve el PDF de la cotización y los datos del ejecutivo desde la sesión.
  const send = await invokeEnviarCotizacion<EnviarEmailResult & { error?: string }>({
    action: "send",
    cotizacion_id: cotizacion.id,
    destinatarios: input.destinatarios,
    cc: input.cc,
    mensaje: input.mensaje,
    asunto: input.asunto,
    marcar_enviada: input.marcarEnviada,
    totales: input.totales,
  }, scope);
  scope.assertCurrent();

  if (!send) throw new Error("Respuesta vacía del servidor");
  if (send.error) throw new Error(send.error);
  return send;
}
