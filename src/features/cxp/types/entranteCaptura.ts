/**
 * Documento del buzón CxP que se está capturando como factura de proveedor.
 * v13.366.0
 * v13.507.0 — Viaja también lo que declaró operaciones al subirlo (proveedor,
 * monto, nota y conceptos sugeridos) para no volver a preguntarlo.
 */
import type { ConceptoSugeridoEntrante } from "@/features/cxp/services/facturasEntrantesConceptos";

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
  /** v13.507.0 — Herencia de operaciones. */
  proveedorId?: string | null;
  proveedorNombre?: string | null;
  montoDeclarado?: number | null;
  monedaDeclarada?: string | null;
  notaOperaciones?: string | null;
  sinCostoCapturado?: boolean;
  creadoEn?: string | null;
}
