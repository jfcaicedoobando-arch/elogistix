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
import { registrarActividad } from "@/services/bitacora/registrar";
import type { CfdiConceptoParsed } from "./parseCfdi.types";
import {
  normalizarClaveSat,
  normalizarDescripcionFiscal,
  parseCantidadFiscal,
  parseImporteFiscal,
} from "@/lib/domain/facturaConceptos";

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
    descripcion: normalizarDescripcionFiscal(c.descripcion) ?? "(Sin descripción)",
    cantidad: parseCantidadFiscal(c.cantidad),
    clave_unidad: normalizarClaveSat(c.clave_unidad),
    monto: parseImporteFiscal(c.importe),
    iva: parseImporteFiscal(c.iva),
    ieps: parseImporteFiscal(c.ieps),
  }));


  const { error } = await supabase.from("proveedor_facturas_conceptos").insert(rows);
  if (error) throw error;
  await registrarActividad({
    modulo: "cxp",
    accion: "insertar_conceptos_cfdi",
    entidadId: facturaId,
    detalles: { total: rows.length },
  });
  return rows.length;
}

export interface ConceptoCfdiRow {
  id: string;
  descripcion: string;
  cantidad: number;
  clave_unidad: string | null;
  monto: number;
  iva: number;
  ieps: number;
  created_at: string;
}

/** Lee las líneas del CFDI persistidas (concepto_costo_id NULL) para una factura. */
export async function fetchConceptosCfdi(facturaId: string): Promise<ConceptoCfdiRow[]> {
  const { data, error } = await supabase
    .from("proveedor_facturas_conceptos")
    .select("id, descripcion, cantidad, clave_unidad, monto, iva, ieps, created_at")
    .eq("proveedor_factura_id", facturaId)
    .is("concepto_costo_id", null)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ConceptoCfdiRow[];
}
