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
  ejecutivo: { nombre?: string; email?: string; telefono?: string };
  tasaIva?: number;
}

export interface EnviarEmailResult {
  success: boolean;
  estado: "enviado" | "parcial" | "fallido";
  envio_id: string | null;
  resultados: Array<{ email: string; tipo: string; ok: boolean; error?: string }>;
  pdf_link: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const ENVIAR_URL = `${SUPABASE_URL}/functions/v1/enviar-cotizacion-email`;

async function fetchConReintento(url: string, init: RequestInit): Promise<Response> {
  const delays = [0, 800, 1600]; // 3 intentos: inmediato, 800ms, 1.6s
  let lastErr: unknown;
  for (const delay of delays) {
    if (delay) await new Promise((r) => setTimeout(r, delay));
    try {
      return await fetch(url, init);
    } catch (e) {
      lastErr = e;
      // Sólo reintentamos errores de red (TypeError: Failed to fetch).
      // Cualquier otra cosa se propaga inmediatamente.
      const isNet = e instanceof TypeError;
      if (!isNet) throw e;
    }
  }
  throw lastErr;
}

async function invokeEnviarCotizacion<T = unknown>(body: Record<string, unknown>): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
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
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`No se pudo contactar al servicio de correo: ${msg}`);
  }

  const raw = await resp.text();
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
  // Reusa la misma plantilla que el botón "Exportar PDF".
  const { CotizacionDocument } = await import("@/pdf/documents/CotizacionDocument");
  const { cargarEmisorEmpresa } = await import("@/pdf/emisor");
  const { pdf } = await import("@react-pdf/renderer");
  const emisor = await cargarEmisorEmpresa();
  const instance = pdf(<CotizacionDocument cotizacion={cotizacion} tasaIva={tasaIva} emisor={emisor} />);
  return await instance.toBlob();
}

export async function enviarCotizacionPorEmail(input: EnviarEmailInput): Promise<EnviarEmailResult> {
  const { cotizacion, tasaIva = TASA_IVA } = input;

  // 1. prepare → signed upload URL
  const prep = await invokeEnviarCotizacion<PrepareResponse>({
    action: "prepare",
    cotizacion_id: cotizacion.id,
  });
  if (!prep?.upload_token || !prep?.path) {
    throw new Error(prep?.error ?? "No se pudo preparar la subida del PDF");
  }

  // 2. Generar PDF
  const blob = await generarPdfBlob(cotizacion, tasaIva);

  // 3. Subir con signed upload URL
  const { error: uploadErr } = await supabase
    .storage.from("cotizaciones-pdf")
    .uploadToSignedUrl(prep.path, prep.upload_token, blob, { contentType: "application/pdf" });
  if (uploadErr) throw new Error(`Subida de PDF falló: ${uploadErr.message}`);

  // 4. send
  const send = await invokeEnviarCotizacion<EnviarEmailResult & { error?: string }>({
    action: "send",
    cotizacion_id: cotizacion.id,
    destinatarios: input.destinatarios,
    cc: input.cc,
    mensaje: input.mensaje,
    asunto: input.asunto,
    marcar_enviada: input.marcarEnviada,
    pdf_path: prep.path,
    totales: input.totales,
    ejecutivo: input.ejecutivo,
  });
  if (!send) throw new Error("Respuesta vacía del servidor");
  if (send.error) throw new Error(send.error);
  return send;
}
