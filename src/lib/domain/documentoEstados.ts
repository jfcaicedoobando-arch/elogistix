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
  /** Estatus derivado de la lista (Vencida, Parcial, Por vencer…), si se conoce. */
  estatus?: string | null;
  /** Días de atraso, para matizar el paso actual con el dato exacto. */
  diasVencido?: number | null;
}

/** Matices que se muestran junto al paso actual, no son pasos propios. */
const SUB_ETIQUETAS: Record<string, string> = {
  "Parcialmente pagada": "Parcialmente pagada",
  Parcial: "Parcialmente pagada",
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
  subTono: "warning" | "destructive" = "warning",
): EstadoDocumentoResumen {
  return {
    pasos,
    indiceActual: etiquetaTerminal ? -1 : indiceActual,
    terminal: !!etiquetaTerminal,
    etiquetaTerminal,
    subEtiqueta: etiquetaTerminal ? null : subEtiqueta,
    subTono,
  };
}

export function resumenFacturaEmitida(estado: string | null | undefined): EstadoDocumentoResumen {
  const key = estado ?? "";
  const terminal = TERMINALES_EMITIDA[key] ?? null;
  const indice = INDICE_EMITIDA[key];
  return resumen(PASOS_EMITIDA, indice ?? 0, terminal, subEtiquetaDe(key));
}

/** Matiz del paso actual de una factura recibida, priorizando el atraso real. */
function matizRecibida(input: EstadoRecibidaInput): {
  sub: string | null;
  tono: "warning" | "destructive";
} {
  const dias = input.diasVencido ?? 0;
  const vencida = input.estatus === "Vencida" || input.estado === "Vencida" || dias > 0;
  if (vencida) {
    return {
      sub: dias > 0 ? `Vencida · ${dias} d` : "Vencida",
      tono: "destructive",
    };
  }
  const sub = subEtiquetaDe(input.estatus ?? "") ?? subEtiquetaDe(input.estado ?? "");
  return { sub, tono: "warning" };
}

export function resumenFacturaRecibida(input: EstadoRecibidaInput): EstadoDocumentoResumen {
  const estado = input.estado ?? "";
  const { sub, tono } = matizRecibida(input);
  if (estado === "Cancelada") return resumen(PASOS_RECIBIDA, -1, "Cancelada");
  if (estado === "Pagada") return resumen(PASOS_RECIBIDA, 3, null);
  if (input.estadoAprobacion === "rechazada") return resumen(PASOS_RECIBIDA, -1, "Rechazada");
  if (input.estadoAprobacion === "aprobada") return resumen(PASOS_RECIBIDA, 2, null, sub, tono);
  if (estado === "Borrador") return resumen(PASOS_RECIBIDA, 0, null);
  return resumen(PASOS_RECIBIDA, 1, null, sub, tono);
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
  /** true cuando la proforma ya generó factura (aunque siga en preparación). */
  facturada: boolean;
  /**
   * B9: true sólo cuando alguna factura de la proforma ya salió de Borrador /
   * Por timbrar. Si se omite se asume el comportamiento previo (facturada =
   * emitida), para no cambiar superficies que aún no conocen las facturas.
   */
  facturaEmitida?: boolean;
  /** Matiz a mostrar cuando la conversión aún no se emite. */
  etiquetaConversion?: string | null;
}

export function resumenProforma(input: EstadoProformaInput): EstadoDocumentoResumen {
  if (input.estadoCliente === "rechazada") {
    return resumen(PASOS_PROFORMA, -1, "Rechazada por el cliente");
  }
  if (input.facturada) {
    const emitida = input.facturaEmitida ?? true;
    if (emitida) return resumen(PASOS_PROFORMA, 3, null);
    // Convertida pero sin emitir: el ciclo se queda en "Aceptada" con matiz.
    return resumen(
      PASOS_PROFORMA,
      2,
      null,
      input.etiquetaConversion ?? "Convertida, sin emitir",
      "warning",
    );
  }
  if (input.estadoCliente === "aceptada") return resumen(PASOS_PROFORMA, 2, null);
  if (input.enviadaAt) return resumen(PASOS_PROFORMA, 1, null, "Pendiente del cliente");
  return resumen(PASOS_PROFORMA, 0, null);
}
