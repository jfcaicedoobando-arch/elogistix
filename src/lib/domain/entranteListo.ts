/**
 * Semáforo "listo para capturar" del buzón de facturas de proveedor.
 *
 * Reglas puras (sin React ni Supabase): dado un documento del buzón, dicen si
 * contabilidad puede capturarlo de corrido o qué le falta para poder hacerlo.
 * v13.366.0
 */

export interface DocumentoEntranteMin {
  estado?: string | null;
  xml_path?: string | null;
  uuid_fiscal?: string | null;
  rfc_emisor?: string | null;
  proveedor_id?: string | null;
  total_detectado?: number | null;
  proveedores?: { nombre?: string | null; origen_proveedor?: string | null } | null;
}

export type NivelListo = "listo" | "revisar" | "bloqueado";

export interface ResultadoListo {
  nivel: NivelListo;
  /** Qué falta o qué hay que revisar antes de guardar la factura. */
  faltantes: string[];
  /** El botón "Capturar factura" se habilita salvo que esté bloqueado. */
  puedeCapturar: boolean;
}

/** Un documento nacional sin XML no trae datos fiscales que precargar. */
export function esProveedorNacional(doc: DocumentoEntranteMin): boolean {
  const origen = doc.proveedores?.origen_proveedor;
  // Sin proveedor identificado asumimos nacional: es el caso que exige XML.
  return origen === null || origen === undefined || origen === "Nacional";
}

/**
 * Evalúa el documento. `bloqueado` sólo cuando la captura no puede ni empezar
 * (documento ya procesado); lo demás es "revisar": se puede capturar, pero el
 * contador tendrá que completar datos a mano.
 */
export function evaluarListoEntrante(doc: DocumentoEntranteMin): ResultadoListo {
  const faltantes: string[] = [];

  if ((doc.estado ?? "por_capturar") !== "por_capturar") {
    return {
      nivel: "bloqueado",
      faltantes: ["El documento ya fue procesado."],
      puedeCapturar: false,
    };
  }

  const nacional = esProveedorNacional(doc);
  if (nacional && !doc.xml_path) faltantes.push("Falta el XML del CFDI");
  if (!doc.proveedor_id && !doc.rfc_emisor) faltantes.push("Proveedor sin identificar");
  if (!doc.total_detectado && nacional && !doc.xml_path) faltantes.push("Sin importe detectado");

  return {
    nivel: faltantes.length === 0 ? "listo" : "revisar",
    faltantes,
    puedeCapturar: true,
  };
}

/** Texto corto para el tooltip / badge de la fila. */
export function etiquetaListoEntrante(res: ResultadoListo): string {
  if (res.nivel === "listo") return "Listo para capturar";
  if (res.nivel === "bloqueado") return "Ya procesado";
  return res.faltantes.join(" · ");
}
