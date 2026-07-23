import { supabase } from "@/integrations/supabase/client";
import { parseFunctionError, FacturapiError } from "./facturapiError";

export interface ConsultarFacturapiRelacionado {
  relationship: string | null;
  uuid?: string | null;
  folio?: number | null;
  serie?: string | null;
  total?: number | null;
  id?: string;
}

export interface ConsultarFacturapiResult {
  ok: true;
  reconciliada: boolean;
  divergencias: string[];
  remoto: {
    status: string | null;
    cancellation_status: string;
    canceled_at: string | null;
    uuid: string | null;
    folio: number | null;
    serie: string | null;
    related_documents: ConsultarFacturapiRelacionado[];
  };
  local: {
    estado: string | null;
    cancellation_status: string;
    uuid_fiscal: string | null;
  };
}

interface EdgeErrorBody {
  error?: string;
  message?: string;
  transient?: boolean;
}

/**
 * Consulta el estado en vivo de una factura en FacturApi
 * (`GET /v2/invoices/{id}`) y reconcilia BD si detecta divergencia.
 */
export async function consultarEstadoFacturapi(
  facturaId: string,
): Promise<ConsultarFacturapiResult> {
  const { data, error } = await supabase.functions.invoke<ConsultarFacturapiResult & EdgeErrorBody>(
    "facturapi-consultar",
    { body: { factura_id: facturaId } },
  );
  if (error) {
    const body = await parseFunctionError(error);
    const msg = body.message ?? body.error ?? (error as { message?: string })?.message
      ?? "No se pudo consultar el estado en FacturApi.";
    throw new FacturapiError(msg, !!body.transient);
  }
  if (!data || data.error) {
    throw new FacturapiError(data?.error ?? "Respuesta vacía de FacturApi.", false);
  }
  return data;
}
