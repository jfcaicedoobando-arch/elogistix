/**
 * Historial seguro de una factura emitida.
 *
 * La RPC valida acceso a la factura antes de devolver bitácora, para evitar
 * consultar el listado global de auditoría desde el detalle.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { EntradaBitacora } from "@/types/bitacora";

function jsonToRecord(value: Json): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
}

export async function fetchHistorialFacturaEmitida(
  facturaId: string,
  limite = 50,
): Promise<EntradaBitacora[]> {
  const { data, error } = await supabase.rpc("historial_factura", {
    p_factura_id: facturaId,
    p_limite: limite,
  });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    ...row,
    detalles: jsonToRecord(row.detalles),
  }));
}