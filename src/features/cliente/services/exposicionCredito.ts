import { supabase } from "@/integrations/supabase/client";

/**
 * Exposición de crédito consolidada del cliente (RPC `get_exposicion_credito_cliente`).
 * Extraído de `crud.ts` (Power of 10 #1).
 */
export interface ExposicionCreditoCliente {
  clienteId: string;
  organizationId: string | null;
  diasCredito: number | null;
  limiteMxn: number | null;
  enUsoMxn: number;
  disponibleMxn: number | null;
  excedido: boolean;
  facturasVivas: number;
}

export async function fetchExposicionCreditoCliente(
  clienteId: string,
): Promise<ExposicionCreditoCliente | null> {
  const { data, error } = await supabase.rpc("get_exposicion_credito_cliente", {
    p_cliente_id: clienteId,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    clienteId: row.cliente_id,
    organizationId: row.organization_id ?? null,
    diasCredito: row.dias_credito ?? null,
    limiteMxn: row.limite_mxn == null ? null : Number(row.limite_mxn),
    enUsoMxn: Number(row.en_uso_mxn ?? 0),
    disponibleMxn: row.disponible_mxn == null ? null : Number(row.disponible_mxn),
    excedido: Boolean(row.excedido),
    facturasVivas: Number(row.facturas_vivas ?? 0),
  };
}
