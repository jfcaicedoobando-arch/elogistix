export interface CfdiConceptoParsed {
  descripcion: string;
  importe: number;
}

export interface CfdiParsedResponse {
  cfdi: {
    uuid: string;
    serie: string;
    folio: string;
    fecha: string;
    moneda: string;
    tipo_cambio: number;
    subtotal: number;
    total: number;
    iva_trasladado: number;
    retenciones: number;
    emisor: { rfc: string; nombre: string; regimen: string };
    receptor: { rfc: string; nombre: string };
    conceptos: CfdiConceptoParsed[];
  };
  ai: { categoria_id: string | null; notas: string };
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
