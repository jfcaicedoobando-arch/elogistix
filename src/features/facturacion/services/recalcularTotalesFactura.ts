/**
 * BL-4: el recálculo de `subtotal`, `iva`, `ret_isr`, `ret_iva` y `total` de una
 * factura vive EXCLUSIVAMENTE en la base de datos (`public.recalc_factura_totales`).
 *
 * Antes esta función replicaba la fórmula en el cliente y escribía `facturas`
 * por su cuenta, mientras el trigger de BD hacía lo mismo. Con dos sesiones
 * editando conceptos de la misma factura, la última escritura del cliente podía
 * pisar el total correcto del trigger y descuadrar `facturas.total`.
 *
 * Ahora se delega a la RPC (una sola transacción, una sola fórmula) y se relee
 * el resultado para que la UI muestre lo mismo que quedó persistido.
 */
import { supabase } from "@/integrations/supabase/client";
import { unwrap } from "@/lib/supabase/response";

export interface TotalesFactura {
  subtotal: number;
  iva: number;
  retIsr: number;
  retIva: number;
  total: number;
}

export async function recalcularTotalesFactura(facturaId: string): Promise<TotalesFactura> {
  const { error } = await supabase.rpc("recalc_factura_totales", { p_factura_id: facturaId });
  if (error) throw error;

  const row = await unwrap(
    supabase
      .from("facturas")
      .select("subtotal, iva, ret_isr, ret_iva, total")
      .eq("id", facturaId)
      .maybeSingle(),
  );

  // RN-BL-6: sin fila NO se devuelven ceros. Antes un `?? 0` convertía un
  // bloqueo de RLS o una factura borrada en "totales en cero", que la UI
  // mostraba como si la factura no tuviera importe.
  if (!row) {
    throw new Error(
      "No se pudo leer la factura después de recalcular sus totales. " +
        "Vuelve a cargar la pantalla; si persiste, no tienes acceso a esa factura.",
    );
  }

  return {
    subtotal: Number(row.subtotal ?? 0),
    iva: Number(row.iva ?? 0),
    retIsr: Number(row.ret_isr ?? 0),
    retIva: Number(row.ret_iva ?? 0),
    total: Number(row.total ?? 0),
  };
}

