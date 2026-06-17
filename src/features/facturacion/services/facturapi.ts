import { supabase } from "@/integrations/supabase/client";

export interface TimbradoResult {
  uuid: string;
  folio: number;
  serie: string;
  facturapi_id: string;
  pdf_url: string;
  xml_url: string;
}

export interface ValidationIssue { field: string; message: string }

export async function emitirFacturapi(facturaId: string): Promise<TimbradoResult> {
  const { data, error } = await supabase.functions.invoke<TimbradoResult & { error?: string; issues?: ValidationIssue[]; message?: string }>(
    "facturapi-emitir",
    { body: { factura_id: facturaId } },
  );
  if (error) throw new Error(error.message);
  if (data?.error) {
    const issues = data.issues ? `: ${data.issues.map((i) => i.message).join("; ")}` : "";
    throw new Error((data.message ?? data.error) + issues);
  }
  return data as TimbradoResult;
}

export type MotivoCancelacionSat = "01" | "02" | "03" | "04";

export async function cancelarFacturapi(
  facturaId: string,
  motivo: MotivoCancelacionSat,
  sustituyeUuid?: string,
): Promise<void> {
  const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string; message?: string }>(
    "facturapi-cancelar",
    { body: { factura_id: facturaId, motivo, sustituye_uuid: sustituyeUuid } },
  );
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.message ?? data.error);
}
