import { supabase } from "@/integrations/supabase/client";
import { fromDb } from "@/lib/supabase/cast";
import type { ProveedorOperacion } from "./proveedoresCrud";

export async function fetchProveedorOperaciones(
  proveedorId: string,
): Promise<ProveedorOperacion[]> {
  // v13.56.3 — Paginación defensiva: si un proveedor llega a >1000 conceptos
  // habrá que migrar a fetch incremental. Por ahora limit alto evita queries
  // catastróficas sin perder visibilidad de uso real.
  const { data, error } = await supabase
    .from("conceptos_costo")
    .select("*, embarques!conceptos_costo_embarque_id_fkey(expediente, id, cliente_nombre)")
    .eq("proveedor_id", proveedorId)
    .is("deleted_at", null)
    .order("fecha_vencimiento", { ascending: false, nullsFirst: false })
    .limit(1000);
  if (error) throw error;

  return (data ?? []).map((row) => {
    type EmbarqueJoin = { expediente: string; id: string; cliente_nombre: string } | null;
    const embarque = fromDb<EmbarqueJoin>(row.embarques);
    return {
      concepto: row.concepto,
      monto: Number(row.monto),
      moneda: row.moneda,
      estadoLiquidacion: row.estado_liquidacion,
      fechaVencimiento: row.fecha_vencimiento,
      expediente: embarque?.expediente ?? "",
      embarqueId: embarque?.id ?? "",
      clienteNombre: embarque?.cliente_nombre ?? "",
    } satisfies ProveedorOperacion;
  });
}
