/**
 * Edición de los conceptos de una factura de proveedor capturada a mano.
 *
 * Toda la validación vive en la RPC `reemplazar_conceptos_factura_proveedor`
 * (tenant, ausencia de XML/UUID, sin pagos, no cancelada, permisos): aquí sólo
 * se traduce el shape de captura y se registra en bitácora.
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

export interface ReemplazarConceptosParams {
  facturaId: string;
  folio?: string | null;
  conceptos: ReadonlyArray<CfdiConceptoParsed>;
}

export async function reemplazarConceptosFactura(
  params: ReemplazarConceptosParams,
): Promise<number> {
  const payload = params.conceptos.map((c) => ({
    descripcion: normalizarDescripcionFiscal(c.descripcion) ?? "(Sin descripción)",
    cantidad: parseCantidadFiscal(c.cantidad),
    clave_unidad: normalizarClaveSat(c.clave_unidad),
    monto: parseImporteFiscal(c.importe),
    iva: parseImporteFiscal(c.iva),
    ieps: parseImporteFiscal(c.ieps),
  }));

  const { data, error } = await supabase.rpc("reemplazar_conceptos_factura_proveedor", {
    p_factura_id: params.facturaId,
    p_conceptos: payload,
  });
  if (error) throw error;

  await registrarActividad({
    modulo: "cxp",
    accion: "editar_conceptos_factura",
    entidadId: params.facturaId,
    entidadNombre: params.folio ?? "",
    detalles: { conceptos: payload.length },
  });
  return Number(data ?? payload.length);
}
