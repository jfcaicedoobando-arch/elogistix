/**
 * CRUD de conceptos de una factura (tabla `conceptos_factura`) + recálculo
 * de totales de la factura padre. Se usa desde el editor de borrador.
 *
 * Cada renglón lleva su propio régimen de IVA (`tipo_iva`):
 *   - `gravado_16` → tasa vigente (TASA_IVA global)
 *   - `tasa_0`    → 0%
 *   - `exento`    → no aporta IVA (base gravable 0)
 *
 * Además puede llevar retenciones ISR / IVA por renglón (Ola 3 · Item 1).
 * El trigger BD recalcula `facturas.ret_isr`/`ret_iva` y ajusta `total`,
 * pero también reflejamos el cálculo aquí para mantener consistencia
 * inmediata sin depender exclusivamente del round-trip a BD.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { TASA_IVA } from "@/lib/financial/financialUtils";

type Moneda = Database["public"]["Enums"]["moneda"];

export type TipoIvaConcepto = "gravado_16" | "tasa_0" | "exento";

export interface ConceptoFacturaInput {
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  clave_sat?: string | null;
  tipo_iva?: TipoIvaConcepto;
  /** Retención ISR normalizada 0..1 (10% → 0.10). */
  tasa_ret_isr?: number;
  /** Retención IVA normalizada 0..1 (4% → 0.04). */
  tasa_ret_iva?: number;
}

export interface ConceptoFacturaRow {
  id: string;
  factura_id: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  clave_sat: string;
  total: number;
  moneda: Moneda;
  tipo_iva: TipoIvaConcepto;
  tasa_iva_aplicada: number | null;
  tasa_ret_isr: number;
  tasa_ret_iva: number;
  monto_ret_isr: number;
  monto_ret_iva: number;
}

function resolverTasa(tipo: TipoIvaConcepto): number | null {
  if (tipo === "gravado_16") return TASA_IVA;
  if (tipo === "tasa_0") return 0;
  return null; // exento
}

function normalizarLinea(input: ConceptoFacturaInput) {
  const cantidad = Math.max(1, Math.round(Number(input.cantidad) || 0));
  const precio = Number(input.precio_unitario) || 0;
  const tipo_iva: TipoIvaConcepto = input.tipo_iva ?? "gravado_16";
  const descripcion = input.descripcion.trim();
  if (!descripcion) throw new Error("La descripción es obligatoria");
  // α.1 — clave SAT es obligatoria; ya no se autocompleta silenciosamente con
  // "81141601" (Servicios profesionales genéricos). El caller debe elegir del
  // catálogo SAT (`catalogo_claves_sat`) la clave real del servicio facturado.
  const clave = input.clave_sat?.trim();
  if (!clave) {
    throw new Error("La clave SAT (c_ClaveProdServ) es obligatoria. Elige la clave correcta del catálogo SAT.");
  }
  return {
    descripcion,
    cantidad,
    precio_unitario: precio,
    total: Math.round(cantidad * precio * 100) / 100,
    clave_sat: clave,
    tipo_iva,
    tasa_iva_aplicada: resolverTasa(tipo_iva),
    tasa_ret_isr: Number(input.tasa_ret_isr ?? 0),
    tasa_ret_iva: Number(input.tasa_ret_iva ?? 0),
  };
}

export async function agregarConceptoFactura(params: {
  facturaId: string;
  organizationId: string;
  moneda: Moneda;
  input: ConceptoFacturaInput;
}): Promise<void> {
  const linea = normalizarLinea(params.input);
  const { error } = await supabase.from("conceptos_factura").insert({
    factura_id: params.facturaId,
    organization_id: params.organizationId,
    moneda: params.moneda,
    ...linea,
  });
  if (error) throw error;
  await recalcularTotalesFactura(params.facturaId);
}

export async function actualizarConceptoFactura(params: {
  conceptoId: string;
  facturaId: string;
  input: ConceptoFacturaInput;
}): Promise<void> {
  const linea = normalizarLinea(params.input);
  if (!linea.descripcion) throw new Error("La descripción es obligatoria");
  const { error } = await supabase
    .from("conceptos_factura")
    .update(linea)
    .eq("id", params.conceptoId);
  if (error) throw error;
  await recalcularTotalesFactura(params.facturaId);
}

export async function eliminarConceptoFactura(params: {
  conceptoId: string;
  facturaId: string;
}): Promise<void> {
  const { error } = await supabase
    .from("conceptos_factura")
    .delete()
    .eq("id", params.conceptoId);
  if (error) throw error;
  await recalcularTotalesFactura(params.facturaId);
}

/**
 * Suma renglones vigentes y actualiza `subtotal`, `iva`, `ret_isr`, `ret_iva`
 * y `total` en `facturas`. El trigger BD ya hace lo mismo; esta función
 * mantiene la reconciliación inmediata para el cliente.
 */
export async function recalcularTotalesFactura(facturaId: string): Promise<void> {
  const { data, error } = await supabase
    .from("conceptos_factura")
    .select("cantidad, precio_unitario, tasa_iva_aplicada, tipo_iva, tasa_ret_isr, tasa_ret_iva")
    .eq("factura_id", facturaId)
    .is("deleted_at", null);
  if (error) throw error;

  let subtotal = 0;
  let iva = 0;
  let retIsr = 0;
  let retIva = 0;
  for (const c of data ?? []) {
    const importe = Number(c.cantidad) * Number(c.precio_unitario);
    subtotal += importe;
    let tasa: number;
    if (c.tasa_iva_aplicada != null) {
      tasa = Number(c.tasa_iva_aplicada);
    } else {
      const tipo = c.tipo_iva as TipoIvaConcepto | null | undefined;
      tasa = tipo ? (resolverTasa(tipo) ?? 0) : 0;
    }
    iva += importe * tasa;
    retIsr += importe * Number(c.tasa_ret_isr ?? 0);
    retIva += importe * Number(c.tasa_ret_iva ?? 0);
  }
  const r = (n: number) => Math.round(n * 100) / 100;
  const subtotalR = r(subtotal);
  const ivaR = r(iva);
  const retIsrR = r(retIsr);
  const retIvaR = r(retIva);
  const totalR = r(subtotalR + ivaR - retIsrR - retIvaR);

  const { error: uErr } = await supabase
    .from("facturas")
    .update({
      subtotal: subtotalR,
      iva: ivaR,
      ret_isr: retIsrR,
      ret_iva: retIvaR,
      total: totalR,
    })
    .eq("id", facturaId);
  if (uErr) throw uErr;
}

export async function fetchConceptosFactura(facturaId: string): Promise<ConceptoFacturaRow[]> {
  const { data, error } = await supabase
    .from("conceptos_factura")
    .select("id, factura_id, descripcion, cantidad, precio_unitario, clave_sat, total, moneda, tipo_iva, tasa_iva_aplicada, tasa_ret_isr, tasa_ret_iva, monto_ret_isr, monto_ret_iva")
    .eq("factura_id", facturaId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ConceptoFacturaRow[];
}
