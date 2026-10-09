/** Clasificación persistida: nunca inferir salida de caja del método o referencia. */
import { supabase } from "@/integrations/supabase/client";
import { MovimientoVinculoError } from "./conciliacionErrors";

export async function esAjusteProveedorPersistido(pagoId: string): Promise<boolean> {
  const { data, error } = await supabase.from("pagos_proveedor")
    .select("es_ajuste").eq("id", pagoId).is("deleted_at", null).maybeSingle();
  if (error || typeof data?.es_ajuste !== "boolean") {
    throw new MovimientoVinculoError(
      "LC_MOVIMIENTO_PAGO_NO_VERIFICABLE",
      "No se pudo verificar el pago a proveedor. Recarga antes de vincularlo al banco.",
    );
  }
  return data.es_ajuste;
}

export async function assertPagoProveedorMonetario(pagoId: string): Promise<void> {
  if (await esAjusteProveedorPersistido(pagoId)) {
    throw new MovimientoVinculoError(
      "LC_MOVIMIENTO_AJUSTE_NO_MONETARIO",
      "Un ajuste no monetario no puede vincularse a un movimiento bancario.",
    );
  }
}
