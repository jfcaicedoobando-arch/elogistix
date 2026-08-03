/**
 * Vínculo factura de proveedor ↔ conceptos_costo de embarque (Fase 1 conciliación
 * cotizado vs real). Permite traer los conceptos_costo abiertos de un proveedor
 * y registrar el matching línea a línea al capturar la factura.
 *
 * Reglas:
 *  - Sólo trae conceptos con `estado_liquidacion = 'Pendiente'` y `deleted_at IS NULL`.
 *  - Al vincular, inserta filas en `proveedor_facturas_conceptos` y, si el monto
 *    vinculado cubre (≥ 99%) el `concepto_costo.monto`, marca el concepto como
 *    Liquidado con `fecha_pago = fecha_emision` y `referencia_pago = folio`.
 *  - El umbral 99% absorbe diferencias menores por redondeo / IVA proveedor.
 */
import { supabase } from "@/integrations/supabase/client";
import { esEstadoNoVinculable } from "./sugerirEmbarques";

export interface ConceptoCostoAbierto {
  id: string;
  embarque_id: string;
  embarque_expediente: string | null;
  concepto: string;
  monto: number;
  moneda: string;
  fecha_vencimiento: string | null;
}

interface RowJoined {
  id: string;
  embarque_id: string;
  concepto: string;
  monto: number;
  moneda: string;
  fecha_vencimiento: string | null;
  embarques: { expediente: string | null; estado?: string | null } | null;
}

export async function fetchConceptosCostoAbiertosDeProveedor(
  proveedorId: string,
  organizationId: string | null,
): Promise<ConceptoCostoAbierto[]> {
  if (!proveedorId) return [];
  let q = supabase
    .from("conceptos_costo")
    .select("id, embarque_id, concepto, monto, moneda, fecha_vencimiento, embarques(expediente, estado)")
    .eq("proveedor_id", proveedorId)
    .eq("estado_liquidacion", "Pendiente")
    .is("deleted_at", null)
    .order("fecha_vencimiento", { ascending: true, nullsFirst: false })
    .limit(200);
  if (organizationId) q = q.eq("organization_id", organizationId);
  const { data, error } = await q;
  if (error) throw error;
  // SAFE-CAST: shape modelado por RowJoined a partir del select con embed.
  return ((data as unknown as RowJoined[] | null) ?? [])
    // Un embarque Cerrado o Cancelado no puede recibir costos nuevos
    // (lo bloquea el trigger en BD) — no debe ofrecerse para vincular.
    .filter((r) => !esEstadoNoVinculable(r.embarques?.estado))
    .map((r) => ({
      id: r.id,
      embarque_id: r.embarque_id,
      embarque_expediente: r.embarques?.expediente ?? null,
      concepto: r.concepto,
      monto: Number(r.monto),
      moneda: r.moneda,
      fecha_vencimiento: r.fecha_vencimiento,
    }));
}

export interface LineaVinculo {
  conceptoCostoId: string;
  descripcion: string;
  monto: number;
  /** Monto total del concepto_costo original (para decidir auto-liquidación). */
  montoOriginal: number;
}

export interface VincularFacturaInput {
  facturaId: string;
  organizationId: string;
  folio: string;
  fechaEmision: string;
  lineas: LineaVinculo[];
}

/**
 * Fase P.3 (v13.301.89): la liquidación de `conceptos_costo` la determina el
 * trigger `tg_pfc_recalc_liq` en la BD a partir de pagos reales. Este servicio
 * ya no marca conceptos como Pagado desde el cliente para evitar semánticas
 * divergentes (cliente marcaba al facturar; BD marca al pagar).
 */
export async function vincularFacturaAConceptos(
  input: VincularFacturaInput,
): Promise<{ insertadas: number }> {
  if (input.lineas.length === 0) return { insertadas: 0 };

  const inserts = input.lineas.map((l) => ({
    proveedor_factura_id: input.facturaId,
    organization_id: input.organizationId,
    concepto_costo_id: l.conceptoCostoId,
    descripcion: l.descripcion,
    cantidad: 1,
    monto: l.monto,
  }));
  const { error: errIns } = await supabase
    .from("proveedor_facturas_conceptos")
    .insert(inserts);
  if (errIns) throw errIns;
  return { insertadas: inserts.length };
}
