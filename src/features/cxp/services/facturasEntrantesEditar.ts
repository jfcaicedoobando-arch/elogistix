/**
 * v13.508.0 — Corrección de los datos declarados de un documento del buzón CxP.
 *
 * Antes, si operaciones se equivocaba de proveedor, de monto o de conceptos,
 * la única salida era retirar el archivo y volverlo a subir. Ahora los datos
 * declarados se corrigen en su lugar (los archivos nunca se tocan).
 */
import { supabase } from "@/integrations/supabase/client";
import { registrarActividad } from "@/services/bitacora/registrar";

export interface DatosEntranteEditables {
  proveedorId: string | null;
  montoDeclarado: number | null;
  monedaDeclarada: string;
  nota: string;
  sinCostoCapturado: boolean;
}

export interface ConceptoSugeridoEntranteInput {
  conceptoId: string;
  monto: number;
}

/** Actualiza proveedor, monto declarado, nota y bandera de "sin costo". */
export async function actualizarDatosEntrante(
  documentoId: string,
  datos: DatosEntranteEditables,
  nombreArchivo?: string | null,
): Promise<void> {
  // SAFE-CAST: los tipos generados marcan los parámetros opcionales como no
  // nulos; la RPC acepta NULL para limpiar cada dato declarado.
  const args = {
    p_documento_id: documentoId,
    p_proveedor_id: datos.proveedorId,
    p_monto_declarado: datos.montoDeclarado,
    p_moneda_declarada: datos.montoDeclarado != null ? datos.monedaDeclarada : null,
    p_nota: datos.nota.trim() || null,
    p_sin_costo_capturado: datos.sinCostoCapturado,
  } as unknown as { p_documento_id: string };
  const { error } = await supabase.rpc("actualizar_datos_entrante", args);
  if (error) throw error;
  await registrarActividad({
    modulo: "cxp",
    accion: "corregir_datos_entrante",
    entidadId: documentoId,
    entidadNombre: nombreArchivo ?? undefined,
  });
}

/**
 * Reemplaza de forma atómica los conceptos de costo sugeridos del documento.
 * Un arreglo vacío deja el documento sin sugerencias.
 */
export async function reemplazarConceptosEntrante(
  documentoId: string,
  conceptos: readonly ConceptoSugeridoEntranteInput[],
  nombreArchivo?: string | null,
): Promise<void> {
  const { error } = await supabase.rpc("reemplazar_conceptos_entrante", {
    p_documento_id: documentoId,
    p_conceptos: conceptos.map((c) => ({
      concepto_costo_id: c.conceptoId,
      monto_sugerido: c.monto,
    })),
  });
  if (error) throw error;
  await registrarActividad({
    modulo: "cxp",
    accion: "corregir_conceptos_entrante",
    entidadId: documentoId,
    entidadNombre: nombreArchivo ?? undefined,
    detalles: { conceptos: conceptos.length },
  });
}
