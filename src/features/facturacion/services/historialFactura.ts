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

  // P0002 = la factura ya no existe o no es visible (p. ej. se eliminó mientras
  // el detalle seguía abierto): no hay historial que mostrar, no es una falla
  // (JAVASCRIPT-REACT-6Z / 70 / 71).
  if (error?.code === "P0002") return [];
  if (error) throw error;

  return (data ?? []).map((row) => ({
    ...row,
    detalles: jsonToRecord(row.detalles),
  }));
}