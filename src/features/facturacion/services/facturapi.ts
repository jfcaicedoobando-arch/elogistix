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
  sustituidaPorFacturaId?: string,
): Promise<{ sustituida: boolean }> {
  const { data, error } = await supabase.functions.invoke<{ ok?: boolean; sustituida?: boolean; error?: string; message?: string }>(
    "facturapi-cancelar",
    {
      body: {
        factura_id: facturaId,
        motivo,
        sustituye_uuid: sustituyeUuid,
        sustituida_por_factura_id: sustituidaPorFacturaId,
      },
    },
  );
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.message ?? data.error);
  return { sustituida: !!data?.sustituida };
}

/**
 * Clona una factura timbrada como borrador para sustituirla (motivo SAT 01).
 * Devuelve el ID de la factura clonada (estado `Borrador`, con `sustituye_a` enlazado).
 */
export async function duplicarFacturaParaSustitucion(facturaId: string): Promise<string> {
  // SAFE-CAST: RPC tipada en supabase/types.ts retorna uuid de la nueva factura.
  const { data, error } = await supabase.rpc("duplicar_factura_para_sustitucion", {
    p_factura_id: facturaId,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("No se pudo duplicar la factura para sustitución.");
  return data as string;
}

