export interface CfdiConceptoParsed {
  descripcion: string;
  /** Cantidad; opcional para compatibilidad con CFDIs previos al parser v2. */
  cantidad?: number;
  /** Clave SAT de unidad (H87, KGM, etc.); opcional. */
  clave_unidad?: string;
  importe: number;
  iva: number;
  ieps: number;
  /**
   * P2-IVA — ObjetoImp del CFDI 4.0 ("01" = no objeto, "02" = sí objeto).
   * Opcional: los CFDIs leídos antes de este cambio no lo traen.
   */
  objeto_imp?: string;
  /** P2-IVA — Desglose por traslado, tal como lo declaró el proveedor. */
  traslados?: Array<{
    impuesto: string;
    base: number;
    tipo_factor: string;
    tasa_o_cuota: number | null;
    importe: number;
  }>;
}


export interface CfdiParsedResponse {
  cfdi: {
    uuid: string;
    serie: string;
    folio: string;
    fecha: string;
    moneda: string;
    tipo_cambio: number | null; // FIX-11: null cuando el CFDI USD/EUR no trae TC.
    subtotal: number;
    total: number;
    iva_trasladado: number;
    ieps_trasladado: number;
    retenciones: number;
    /** I=Ingreso, E=Egreso, T=Traslado, N=Nómina, P=Pago. */
    tipo_comprobante: string;
    emisor: { rfc: string; nombre: string; regimen: string };
    receptor: { rfc: string; nombre: string };
    conceptos: CfdiConceptoParsed[];
  };
  ai: { categoria_id: string | null; notas: string };
  /**
   * Sólo lo manda `parse-invoice-pdf`: "baja" cuando la IA no pudo copiar el
   * folio literal del documento, por lo que el formulario no lo precarga.
   */
  folio_confianza?: "alta" | "baja";
}


/**
 * Fase en la que falló la subida de CFDI:
 * - `preflight`: CORS u origen no permitido (no llegó al gateway)
 * - `request`:   red caída / DNS / TypeError "Failed to fetch"
 * - `response`:  el gateway respondió pero con status no-OK
 */
export type CfdiUploadPhase = "preflight" | "request" | "response";

export interface CfdiUploadErrorContext {
  attemptCount: number;
  latencyMs: number;
  online: boolean;
  xmlSize: number;
  xmlName: string;
  lastStatus: number | null;
  phase: CfdiUploadPhase;
  errorName: string;
}

export class CfdiUploadError extends Error {
  readonly context: CfdiUploadErrorContext;
  constructor(message: string, context: CfdiUploadErrorContext, cause: unknown) {
    super(message);
    this.name = "CfdiUploadError";
    this.context = context;
    (this as Error & { cause?: unknown }).cause = cause;
  }
}
