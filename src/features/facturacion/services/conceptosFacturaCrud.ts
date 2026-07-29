/**
 * CRUD de conceptos de una factura (tabla `conceptos_factura`).
 *
 * Cada renglón lleva su propio régimen de IVA (`tipo_iva`):
 *   - `gravado_16` → tasa vigente (TASA_IVA global)
 *   - `tasa_0`    → 0%
 *   - `exento`    → no aporta IVA (base gravable 0)
 *
 * Además puede llevar retenciones ISR / IVA por renglón (Ola 3 · Item 1).
 * El recálculo agregado a `facturas` vive en `./recalcularTotalesFactura`.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { run, unwrapOr } from "@/lib/supabase/response";
import { resolverTasa, type TipoIvaConcepto } from "./conceptosFacturaShared";
import { recalcularTotalesFactura } from "./recalcularTotalesFactura";
import { subtotalLinea } from "@/lib/financial/financialUtils";

// Re-export para no romper call-sites externos que importan desde este archivo.
export { recalcularTotalesFactura };
export type { TipoIvaConcepto };

type Moneda = Database["public"]["Enums"]["moneda"];

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
  embarque_id: string | null;
  proforma_id_origen: string | null;
  /** Expediente del embarque origen (join). Null si el concepto no está ligado. */
  embarque_expediente: string | null;
}

function normalizarLinea(input: ConceptoFacturaInput) {
  // M11: coerción fiscal canónica (tolera "1,200.50" y cantidades decimales).
  const cantidad = parseCantidadFiscal(input.cantidad);
  const precio = parseImporteFiscal(input.precio_unitario);
  const tipo_iva: TipoIvaConcepto = input.tipo_iva ?? "gravado_16";
  const descripcion = normalizarDescripcionFiscal(input.descripcion);
  if (!descripcion) throw new Error("La descripción es obligatoria");
  // α.1 — clave SAT es obligatoria; ya no se autocompleta silenciosamente con
  // "81141601" (Servicios profesionales genéricos). El caller debe elegir del
  // catálogo SAT (`catalogo_claves_sat`) la clave real del servicio facturado.
  const clave = normalizarClaveSat(input.clave_sat);
  if (!clave) {
    throw new Error("La clave SAT (c_ClaveProdServ) es obligatoria. Elige la clave correcta del catálogo SAT.");
  }
  return {
    descripcion,
    cantidad,
    precio_unitario: precio,
    total: subtotalLinea(cantidad, precio),
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
  await run(
    supabase.from("conceptos_factura").insert({
      factura_id: params.facturaId,
      organization_id: params.organizationId,
      moneda: params.moneda,
      ...linea,
    }),
  );
  await recalcularTotalesFactura(params.facturaId);
}

export async function actualizarConceptoFactura(params: {
  conceptoId: string;
  facturaId: string;
  input: ConceptoFacturaInput;
}): Promise<void> {
  const linea = normalizarLinea(params.input);
  await run(
    supabase.from("conceptos_factura").update(linea).eq("id", params.conceptoId),
  );
  await recalcularTotalesFactura(params.facturaId);
}

export async function eliminarConceptoFactura(params: {
  conceptoId: string;
  facturaId: string;
}): Promise<void> {
  // v13.290.0 (Papelera Fase 3): soft-delete vía RPC en lugar de DELETE
  // físico, para que el concepto pueda restaurarse desde /papelera.
  const { error } = await supabase.rpc("soft_delete_record", {
    _table: "conceptos_factura",
    _id: params.conceptoId,
  });
  if (error) throw error;
  await recalcularTotalesFactura(params.facturaId);
}

export async function fetchConceptosFactura(facturaId: string): Promise<ConceptoFacturaRow[]> {
  const data = await unwrapOr(
    supabase
      .from("conceptos_factura")
      .select("id, factura_id, descripcion, cantidad, precio_unitario, clave_sat, total, moneda, tipo_iva, tasa_iva_aplicada, tasa_ret_isr, tasa_ret_iva, monto_ret_isr, monto_ret_iva, embarque_id, proforma_id_origen, embarques:embarque_id(expediente)")
      .eq("factura_id", facturaId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
    [],
  );
  // SAFE-CAST: aplanamos el join anidado a `embarque_expediente` para consumo UI.
  return data.map((row) => {
    const emb = (row as { embarques?: { expediente?: string | null } | null }).embarques;
    return {
      ...(row as Omit<ConceptoFacturaRow, "embarque_expediente">),
      embarque_expediente: emb?.expediente ?? null,
    } as ConceptoFacturaRow;
  });
}
