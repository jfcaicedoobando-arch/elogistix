/**
 * Servicios para timbrar y cancelar Notas de Crédito (CFDI tipo E) en
 * FacturApi. Envuelven las edge functions `facturapi-emitir-nota-credito` y
 * `facturapi-cancelar-nota-credito` (Turno A del Paso 3 de fiscal).
 */
import { supabase } from "@/integrations/supabase/client";
import type { MotivoCancelacionSat } from "@/features/facturacion/services/facturapi";

export interface ValidationIssue { field: string; message: string }

export interface TimbradoNcResult {
  uuid: string;
  folio: number;
  serie: string;
  facturapi_id: string;
  pdf_url: string;
  xml_url: string;
}

export async function timbrarNotaCreditoFacturapi(notaCreditoId: string): Promise<TimbradoNcResult> {
  const { data, error } = await supabase.functions.invoke<
    TimbradoNcResult & { error?: string; issues?: ValidationIssue[]; message?: string }
  >("facturapi-emitir-nota-credito", { body: { nota_credito_id: notaCreditoId } });
  if (error) throw new Error(error.message);
  if (data?.error) {
    const issues = data.issues?.length ? `: ${data.issues.map((i) => i.message).join("; ")}` : "";
    throw new Error((data.message ?? data.error) + issues);
  }
  return data as TimbradoNcResult;
}

export async function cancelarNotaCreditoFacturapi(
  notaCreditoId: string,
  motivo: MotivoCancelacionSat,
  sustituyeUuid?: string,
): Promise<{ pending: boolean; message?: string }> {
  const { data, error } = await supabase.functions.invoke<{ ok?: boolean; pending?: boolean; error?: string; message?: string }>(
    "facturapi-cancelar-nota-credito",
    { body: { nota_credito_id: notaCreditoId, motivo, sustituye_uuid: sustituyeUuid } },
  );
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.message ?? data.error);
  // Ola 4 · N4: la cancelación puede quedar pendiente de aceptación del
  // receptor; el hook lo comunica en el toast.
  return { pending: data?.pending ?? false, message: data?.message };
}
