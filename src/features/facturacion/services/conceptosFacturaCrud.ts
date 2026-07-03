/**
 * CRUD de conceptos de una factura (tabla `conceptos_factura`) + recálculo
 * de totales de la factura padre. Se usa desde el editor de borrador.
 *
 * Nota: la tabla `conceptos_factura` sólo tiene columnas base
 * (descripcion, cantidad, precio_unitario, clave_sat, total, moneda).
 * El IVA se calcula al recalcular con la tasa global `TASA_IVA`.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { TASA_IVA } from "@/lib/financial/financialUtils";

type Moneda = Database["public"]["Enums"]["moneda"];

export interface ConceptoFacturaInput {
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  clave_sat?: string | null;
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
}

function normalizarLinea(input: ConceptoFacturaInput) {
  const cantidad = Math.max(1, Math.round(Number(input.cantidad) || 0));
  const precio = Number(input.precio_unitario) || 0;
  return {
    descripcion: input.descripcion.trim(),
    cantidad,
    precio_unitario: precio,
    total: Math.round(cantidad * precio * 100) / 100,
    clave_sat: input.clave_sat?.trim() || "78101800",
  };
}

export async function agregarConceptoFactura(params: {
  facturaId: string;
  organizationId: string;
  moneda: Moneda;
  input: ConceptoFacturaInput;
}): Promise<void> {
  const linea = normalizarLinea(params.input);
  if (!linea.descripcion) throw new Error("La descripción es obligatoria");
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
 * Suma renglones vigentes y actualiza `subtotal`, `iva`, `total` en `facturas`.
 * Idempotente: siempre lee el estado actual de la tabla y reemplaza los totales.
 */
export async function recalcularTotalesFactura(facturaId: string): Promise<void> {
  const { data, error } = await supabase
    .from("conceptos_factura")
    .select("cantidad, precio_unitario")
    .eq("factura_id", facturaId)
    .is("deleted_at", null);
  if (error) throw error;

  let subtotal = 0;
  for (const c of data ?? []) {
    subtotal += Number(c.cantidad) * Number(c.precio_unitario);
  }
  const subtotalR = Math.round(subtotal * 100) / 100;
  const ivaR = Math.round(subtotalR * TASA_IVA * 100) / 100;
  const totalR = Math.round((subtotalR + ivaR) * 100) / 100;

  const { error: uErr } = await supabase
    .from("facturas")
    .update({ subtotal: subtotalR, iva: ivaR, total: totalR })
    .eq("id", facturaId);
  if (uErr) throw uErr;
}

export async function fetchConceptosFactura(facturaId: string): Promise<ConceptoFacturaRow[]> {
  const { data, error } = await supabase
    .from("conceptos_factura")
    .select("id, factura_id, descripcion, cantidad, precio_unitario, clave_sat, total, moneda")
    .eq("factura_id", facturaId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ConceptoFacturaRow[];
}
