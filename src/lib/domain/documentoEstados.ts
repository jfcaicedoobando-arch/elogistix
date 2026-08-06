/**
 * Ciclo de vida visual de los documentos financieros (facturas emitidas y
 * recibidas). Sólo describe los pasos y en cuál está el documento: no cambia
 * ninguna regla de negocio, es la fuente del stepper del encabezado.
 */

export type DocumentoDominio = "factura_emitida" | "factura_recibida";

export interface PasoDocumento {
  id: string;
  label: string;
}

export interface EstadoDocumentoResumen {
  pasos: PasoDocumento[];
  /** Índice del paso actual; -1 cuando el documento está en un estado terminal. */
  indiceActual: number;
  /** true cuando el documento terminó fuera del flujo feliz (cancelada, sustituida). */
  terminal: boolean;
  /** Etiqueta a mostrar cuando `terminal` es true. */
  etiquetaTerminal: string | null;
  /** Matiz del paso actual (ej. "Parcialmente pagada", "Vencida"). */
  subEtiqueta?: string | null;
  /** Tono del matiz: `warning` por defecto, `destructive` cuando hay atraso. */
  subTono?: "warning" | "destructive";
}

const PASOS_EMITIDA: PasoDocumento[] = [
  { id: "borrador", label: "Borrador" },
  { id: "por-timbrar", label: "Por timbrar" },
  { id: "emitida", label: "Emitida" },
  { id: "pagada", label: "Pagada" },
];

const PASOS_RECIBIDA: PasoDocumento[] = [
  { id: "borrador", label: "Borrador" },
  { id: "vigente", label: "Vigente" },
  { id: "aprobada", label: "Aprobada" },
  { id: "pagada", label: "Pagada" },
];

const TERMINALES_EMITIDA: Record<string, string> = {
  Cancelada: "Cancelada",
  Sustituida: "Sustituida",
};

const INDICE_EMITIDA: Record<string, number> = {
  Borrador: 0,
  "Por timbrar": 1,
  Emitida: 2,
  "Parcialmente pagada": 2,
  Vencida: 2,
  Pagada: 3,
};

export interface EstadoRecibidaInput {
  estado: string | null | undefined;
  estadoAprobacion?: string | null;
}

/** Matices que se muestran junto al paso actual, no son pasos propios. */
const SUB_ETIQUETAS: Record<string, string> = {
  "Parcialmente pagada": "Parcialmente pagada",
  Vencida: "Vencida",
};

function subEtiquetaDe(estado: string): string | null {
  return SUB_ETIQUETAS[estado] ?? null;
}

function resumen(
  pasos: PasoDocumento[],
  indiceActual: number,
  etiquetaTerminal: string | null,
  subEtiqueta: string | null = null,
): EstadoDocumentoResumen {
  return {
    pasos,
    indiceActual: etiquetaTerminal ? -1 : indiceActual,
    terminal: !!etiquetaTerminal,
    etiquetaTerminal,
    subEtiqueta: etiquetaTerminal ? null : subEtiqueta,
  };
}

export function resumenFacturaEmitida(estado: string | null | undefined): EstadoDocumentoResumen {
  const key = estado ?? "";
  const terminal = TERMINALES_EMITIDA[key] ?? null;
  const indice = INDICE_EMITIDA[key];
  return resumen(PASOS_EMITIDA, indice ?? 0, terminal, subEtiquetaDe(key));
}

export function resumenFacturaRecibida(input: EstadoRecibidaInput): EstadoDocumentoResumen {
  const estado = input.estado ?? "";
  const sub = subEtiquetaDe(estado);
  if (estado === "Cancelada") return resumen(PASOS_RECIBIDA, -1, "Cancelada");
  if (estado === "Pagada") return resumen(PASOS_RECIBIDA, 3, null);
  if (input.estadoAprobacion === "rechazada") return resumen(PASOS_RECIBIDA, -1, "Rechazada");
  if (input.estadoAprobacion === "aprobada") return resumen(PASOS_RECIBIDA, 2, null, sub);
  if (estado === "Borrador") return resumen(PASOS_RECIBIDA, 0, null);
  return resumen(PASOS_RECIBIDA, 1, null, sub);
}

export function resumenDocumento(
  dominio: DocumentoDominio,
  input: EstadoRecibidaInput,
): EstadoDocumentoResumen {
  return dominio === "factura_emitida"
    ? resumenFacturaEmitida(input.estado)
    : resumenFacturaRecibida(input);
}

const PASOS_PROFORMA: PasoDocumento[] = [
  { id: "emitida", label: "Emitida" },
  { id: "enviada", label: "Enviada" },
  { id: "aceptada", label: "Aceptada" },
  { id: "facturada", label: "Facturada" },
];

export interface EstadoProformaInput {
  /** Respuesta del cliente: pendiente | aceptada | rechazada. */
  estadoCliente: "pendiente" | "aceptada" | "rechazada";
  /** Fecha en que se envió al cliente, si existe. */
  enviadaAt?: string | null;
  /** true cuando la proforma ya generó factura. */
  facturada: boolean;
}

export function resumenProforma(input: EstadoProformaInput): EstadoDocumentoResumen {
  if (input.estadoCliente === "rechazada") {
    return resumen(PASOS_PROFORMA, -1, "Rechazada por el cliente");
  }
  if (input.facturada) return resumen(PASOS_PROFORMA, 3, null);
  if (input.estadoCliente === "aceptada") return resumen(PASOS_PROFORMA, 2, null);
  if (input.enviadaAt) return resumen(PASOS_PROFORMA, 1, null, "Pendiente del cliente");
  return resumen(PASOS_PROFORMA, 0, null);
}
