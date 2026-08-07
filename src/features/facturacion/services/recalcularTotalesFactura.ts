/**
 * Recalcula `subtotal`, `iva`, `ret_isr`, `ret_iva` y `total` en `facturas`
 * a partir de los renglones vigentes de `conceptos_factura`. El trigger BD
 * ya hace lo mismo; esta función mantiene la reconciliación inmediata en el
 * cliente sin depender del round-trip.
 */
import { supabase } from "@/integrations/supabase/client";
import { registrarActividad } from "@/services/bitacora/registrar";
import { run, unwrapOr } from "@/lib/supabase/response";
import { resolverTasa, type TipoIvaConcepto } from "./conceptosFacturaShared";
import { roundMoney, subtotalLinea, calcularIVA } from "@/lib/financial/financialUtils";

export async function recalcularTotalesFactura(facturaId: string): Promise<void> {
  const data = await unwrapOr(
    supabase
      .from("conceptos_factura")
      .select("cantidad, precio_unitario, tasa_iva_aplicada, tipo_iva, tasa_ret_isr, tasa_ret_iva")
      .eq("factura_id", facturaId)
      .is("deleted_at", null),
    [],
  );

  let subtotal = 0;
  let iva = 0;
  let retIsr = 0;
  let retIva = 0;
  for (const c of data) {
    const importe = subtotalLinea(Number(c.cantidad), Number(c.precio_unitario));
    subtotal += importe;
    let tasa: number;
    if (c.tasa_iva_aplicada != null) {
      tasa = Number(c.tasa_iva_aplicada);
    } else {
      const tipo = c.tipo_iva as TipoIvaConcepto | null | undefined;
      tasa = tipo ? (resolverTasa(tipo) ?? 0) : 0;
    }
    iva += calcularIVA(importe, tasa);
    retIsr += importe * Number(c.tasa_ret_isr ?? 0);
    retIva += importe * Number(c.tasa_ret_iva ?? 0);
  }
  const r = roundMoney;
  const subtotalR = r(subtotal);
  const ivaR = r(iva);
  const retIsrR = r(retIsr);
  const retIvaR = r(retIva);
  const totalR = r(subtotalR + ivaR - retIsrR - retIvaR);

  await run(
    supabase
      .from("facturas")
      .update({
        subtotal: subtotalR,
        iva: ivaR,
        ret_isr: retIsrR,
        ret_iva: retIvaR,
        total: totalR,
      })
      .eq("id", facturaId),
  );
  await registrarActividad({
    modulo: "facturacion",
    accion: "recalcular_totales_factura",
    entidadId: facturaId,
    detalles: { subtotal: subtotalR, iva: ivaR, retIsr: retIsrR, retIva: retIvaR, total: totalR },
  });
}
