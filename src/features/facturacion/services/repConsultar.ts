/**
 * Consulta manual del estado de un REP en FacturApi (sin esperar el cron de
 * reconciliación de cancelaciones, que corre cada 30 minutos).
 */
import { supabase } from "@/integrations/supabase/client";
import { parseFunctionError, toReadableError, type EdgeErrorBody } from "./facturapiError";

export interface ConsultarRepResult {
  ok: true;
  actualizado: boolean;
  outcome: string;
  remoto: { status: string | null; cancellation_status: string };
  local: { estado_rep: string | null; rep_cancellation_status: string };
}

export async function consultarEstadoRep(pagoId: string): Promise<ConsultarRepResult> {
  const { data, error } = await supabase.functions.invoke<ConsultarRepResult & EdgeErrorBody>(
    "facturapi-consultar-rep",
    { body: { pago_id: pagoId } },
  );
  if (error) {
    throw toReadableError(error, await parseFunctionError(error), "No se pudo consultar el estado del REP.");
  }
  if (!data || data.error) {
    throw toReadableError(null, data ?? {}, "No se pudo consultar el estado del REP.");
  }
  return data;
}
