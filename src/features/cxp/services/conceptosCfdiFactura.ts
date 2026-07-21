/**
 * Persistencia de conceptos fiscales del XML CFDI en
 * `public.proveedor_facturas_conceptos`.
 *
 * Estas filas representan las líneas del XML del proveedor (informativas para
 * auditoría fiscal). Llevan `concepto_costo_id = NULL`; la vinculación con
 * `conceptos_costo` del embarque la hace el usuario aparte y produce filas
 * distintas con `concepto_costo_id` poblado.
 */
import { supabase } from "@/integrations/supabase/client";
import type { CfdiConceptoParsed } from "./parseCfdi.types";

export interface InsertarConceptosCfdiParams {
  facturaId: string;
  organizationId: string;
  conceptos: ReadonlyArray<CfdiConceptoParsed>;
}

/** Bulk-insert de conceptos del CFDI. Devuelve la cantidad insertada. */
export async function insertarConceptosCfdi(
  params: InsertarConceptosCfdiParams,
): Promise<number> {
  const { facturaId, organizationId, conceptos } = params;
  if (!conceptos.length) return 0;

  const rows = conceptos.map((c) => ({
    proveedor_factura_id: facturaId,
    organization_id: organizationId,
    concepto_costo_id: null,
    descripcion: c.descripcion?.trim() || "(Sin descripción)",
    cantidad: Number(c.cantidad ?? 1) || 1,
    clave_unidad: c.clave_unidad ?? null,
    monto: Number(c.importe) || 0,
    iva: Number(c.iva) || 0,
    ieps: Number(c.ieps) || 0,
  }));

  const { error } = await supabase.from("proveedor_facturas_conceptos").insert(rows);
  if (error) throw error;
  return rows.length;
}
