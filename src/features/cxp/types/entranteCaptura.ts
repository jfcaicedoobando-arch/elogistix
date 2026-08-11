import type { ConceptoSugeridoEntrante } from "@/features/cxp/services/facturasEntrantesConceptos";

/**
 * Documento del buzón CxP que se está capturando como factura de proveedor.
 * v13.366.0
 */
export interface EntranteParaCaptura {
  id: string;
  embarqueId: string;
  expediente: string | null;
  archivoPath: string;
  nombreArchivo: string;
  xmlPath: string | null;
  xmlNombre: string | null;
  totalDetectado: number | null;
  monedaDetectada: string | null;
  /** v13.506.0 — Conceptos de costo sugeridos por operaciones al subir. */
  conceptosSugeridos?: ConceptoSugeridoEntrante[];
}
