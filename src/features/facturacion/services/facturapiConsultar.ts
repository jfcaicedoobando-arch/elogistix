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

/** Estatus reportado por el servicio público de consulta del SAT. */
export type EstatusSatConsulta = "Vigente" | "Cancelado" | "No encontrado" | "No verificable" | "Error";

/** Metadatos leídos del XML timbrado de la factura + su estatus en el SAT. */
export interface ConsultarFacturapiXml {
  disponible: boolean;
  uuid: string | null;
  rfc_emisor: string | null;
  rfc_receptor: string | null;
  total: number | null;
  moneda: string | null;
  fecha: string | null;
  serie: string | null;
  folio: string | null;
  estatus_sat: EstatusSatConsulta;
  sat_detalle: string;
  diferencias: string[];
  error: string | null;
}

/** Verificación de un REP (complemento de pago) timbrado de la factura. */
export interface ConsultarFacturapiRep {
  pago_id: string;
  folio: string | null;
  fecha_pago: string | null;
  estado_rep: string | null;
  rep_cancellation_status: string | null;
  remoto_cancellation_status: string | null;
  remoto_status: string | null;
  uuid: string | null;
  monto: number | null;
  moneda: string | null;
  estatus_sat: EstatusSatConsulta;
  diferencias: string[];
  reconciliado: boolean;
  error: string | null;
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
  /** XML de la factura (null si FacturApi no lo entregó o no hay credenciales). */
  xml?: ConsultarFacturapiXml | null;
  /** XMLs de los REPs timbrados, incluidos los cancelados. */
  reps?: ConsultarFacturapiRep[];
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
