/**
 * Servicio: envío branded de factura por correo (PDF+XML) al cliente.
 * Homólogo a `enviarCotizacionPorEmail` — llama a la edge function
 * `enviar-factura-email` con reintentos ante fallos de red.
 */
import { supabase } from "@/integrations/supabase/client";
import { fetchConReintento, OFFLINE_MSG } from "@/features/cotizacion/services/mutations/enviarPorEmail";

export interface DestinatarioFacturaEnvio {
  email: string;
  nombre?: string;
  contacto_id?: string;
}

export interface EnviarFacturaEmailInput {
  facturaId: string;
  destinatarios: DestinatarioFacturaEnvio[];
  cc: string[];
  asunto: string;
  mensaje: string;
  totalFormateado?: string;
  ejecutivo: { nombre?: string; email?: string; telefono?: string };
}

export interface EnviarFacturaEmailResult {
  success: boolean;
  estado: "enviado" | "parcial" | "fallido";
  envio_id: string | null;
  resultados: Array<{ email: string; tipo: string; ok: boolean; error?: string }>;
  pdf_link: string;
  xml_link: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const URL = `${SUPABASE_URL}/functions/v1/enviar-factura-email`;

export async function enviarFacturaPorEmail(
  input: EnviarFacturaEmailInput,
): Promise<EnviarFacturaEmailResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    throw new Error("Tu sesión expiró. Vuelve a iniciar sesión e intenta de nuevo.");
  }

  let resp: Response;
  try {
    resp = await fetchConReintento(URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        factura_id: input.facturaId,
        destinatarios: input.destinatarios,
        cc: input.cc,
        asunto: input.asunto,
        mensaje: input.mensaje,
        total_formateado: input.totalFormateado,
        ejecutivo: input.ejecutivo,
      }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === OFFLINE_MSG) throw Object.assign(new Error(OFFLINE_MSG), { cause: e });
    throw new Error(`No se pudo contactar al servicio de correo: ${msg}`);
  }

  const raw = await resp.text();
  let parsed: unknown = null;
  try { parsed = raw ? JSON.parse(raw) : null; } catch { /* no-json */ }
  if (!resp.ok) {
    const detalle = (parsed && typeof parsed === "object" && "error" in parsed
      ? String((parsed as { error: unknown }).error)
      : raw) || `HTTP ${resp.status}`;
    throw new Error(`Servicio de correo (${resp.status}): ${detalle}`);
  }
  return (parsed ?? {}) as EnviarFacturaEmailResult;
}
