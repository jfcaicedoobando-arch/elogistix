/**
 * P2-A · Verificación remota (opt-in) de la configuración del webhook de
 * facturación electrónica, por ambiente (pruebas / producción).
 *
 * Llama a la edge function `facturapi-verificar-webhook`, que compara contra el
 * proveedor la dirección registrada, los eventos suscritos y el estado.
 * SEGURIDAD: la respuesta nunca trae claves ni secretos.
 */
import { supabase } from "@/integrations/supabase/client";
import type { FacturapiAmbiente } from "./facturapiCredenciales";

export type EstadoWebhook =
  | "ok"
  | "no_configurado"
  | "no_encontrado"
  | "url_distinta"
  | "eventos_faltantes"
  | "inactivo"
  | "error";

export interface DiagnosticoWebhook {
  ambiente: FacturapiAmbiente;
  estado: EstadoWebhook;
  mensaje: string;
  urlEsperada: string;
  urlRemota: string | null;
  webhookId: string | null;
  eventosFaltantes: string[];
  eventosRemotos: string[];
  secretLegado: boolean;
  secretConfigurado: boolean;
}

export interface VerificarWebhookResult {
  ok: boolean;
  diagnostico?: DiagnosticoWebhook;
  error?: string;
  message?: string;
  retry_after_segundos?: number | null;
}

async function leerBodyDeError(error: unknown): Promise<VerificarWebhookResult | null> {
  const ctx = (error as { context?: unknown }).context;
  if (!(ctx instanceof Response)) return null;
  try {
    return (await ctx.clone().json()) as VerificarWebhookResult;
  } catch {
    return null;
  }
}

export async function verificarFacturapiWebhook(
  orgId: string,
  ambiente: FacturapiAmbiente,
): Promise<VerificarWebhookResult> {
  const { data, error } = await supabase.functions.invoke<VerificarWebhookResult>(
    "facturapi-verificar-webhook",
    { body: { organization_id: orgId, ambiente } },
  );
  if (error) {
    const body = await leerBodyDeError(error);
    if (body) return { ...body, ok: false };
    throw new Error(
      error.message || "No fue posible verificar el webhook con el proveedor de timbrado.",
    );
  }
  return data ?? { ok: false, error: "empty_response" };
}
