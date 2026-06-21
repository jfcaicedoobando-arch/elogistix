/**
 * Servicio cliente para timbrado y cancelación del REP (Complemento de Pagos).
 * v13.91.0
 */
import { supabase } from "@/integrations/supabase/client";

export interface RepTimbradoResult {
  uuid: string;
  folio: number;
  serie: string;
  facturapi_id: string;
  pdf_url: string;
  xml_url: string;
}

export interface ValidationIssue { field: string; message: string }

export async function emitirRep(pagoId: string): Promise<RepTimbradoResult> {
  const { data, error } = await supabase.functions.invoke<RepTimbradoResult & { error?: string; issues?: ValidationIssue[]; message?: string }>(
    "facturapi-emitir-rep",
    { body: { pago_id: pagoId } },
  );
  if (error) throw new Error(error.message);
  if (data?.error) {
    const issues = data.issues ? `: ${data.issues.map((i) => i.message).join("; ")}` : "";
    throw new Error((data.message ?? data.error) + issues);
  }
  return data as RepTimbradoResult;
}

export type MotivoCancelacionSat = "01" | "02" | "03" | "04";

export async function cancelarRep(
  pagoId: string,
  motivo: MotivoCancelacionSat,
  sustituyeUuid?: string,
): Promise<void> {
  const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string; message?: string }>(
    "facturapi-cancelar-rep",
    { body: { pago_id: pagoId, motivo, sustituye_uuid: sustituyeUuid } },
  );
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.message ?? data.error);
}
