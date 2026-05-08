import { supabase } from "@/integrations/supabase/client";
import type { ProformaRow } from "./types";
import { fromDb } from "@/lib/supabase/cast";

export interface ConsolidarProformasParams {
  organizationId: string;
  proformaIds: string[];
  embarqueId: string;
  clienteId: string;
  clienteNombre: string;
  expediente: string;
  blMaster: string | null;
  operador: string | null;
  diasCredito: number | null;
  /** Tasa de IVA vigente (no hard-codear). */
  tasaIva: number;
}

/**
 * Consolida varias proformas en una nueva. Toda la lógica corre en una RPC
 * atómica del lado del servidor (`consolidar_proformas`), por lo que no se
 * requiere rollback manual: si algún paso falla, la transacción completa
 * se revierte y no quedan registros huérfanos.
 */
export async function consolidarProformas(params: ConsolidarProformasParams): Promise<ProformaRow> {
  if (params.proformaIds.length < 2) {
    throw new Error("Selecciona al menos 2 proformas para consolidar");
  }

  const { data, error } = await supabase.rpc("consolidar_proformas", {
    p_organization_id: params.organizationId,
    p_proforma_ids: params.proformaIds,
    p_embarque_id: params.embarqueId,
    p_cliente_id: params.clienteId,
    p_cliente_nombre: params.clienteNombre,
    p_expediente: params.expediente,
    p_bl_master: params.blMaster,
    p_operador: params.operador,
    p_dias_credito: params.diasCredito,
    p_tasa_iva: params.tasaIva,
  });
  if (error) throw error;
  if (!data) throw new Error("La consolidación no devolvió la proforma resultante");
  return fromDb<ProformaRow>(data);
}
