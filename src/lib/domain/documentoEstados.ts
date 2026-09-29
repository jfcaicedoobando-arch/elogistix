/**
 * Ciclo de vida visual de los documentos financieros (facturas emitidas y
 * recibidas). Sólo describe los pasos y en cuál está el documento: no cambia
 * ninguna regla de negocio, es la fuente del stepper del encabezado.
 */

import { resumenDocumentoBase as resumen } from "@/lib/documentoResumen";
import type { EstadoDocumentoResumen, PasoDocumento } from "@/lib/documentoResumen";

export type { EstadoDocumentoResumen, PasoDocumento } from "@/lib/documentoResumen";

export type DocumentoDominio = "factura_emitida" | "factura_recibida";

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

export function resumenFacturaEmitida(estado: string | null | undefined): EstadoDocumentoResumen {
  const key = estado ?? "";
  const terminal = TERMINALES_EMITIDA[key] ?? null;
  const indice = INDICE_EMITIDA[key];
  return resumen(PASOS_EMITIDA, indice ?? 0, terminal, { subEtiqueta: subEtiquetaDe(key) });
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
  if (input.estadoAprobacion === "aprobada") return resumen(PASOS_RECIBIDA, 2, null, { subEtiqueta: sub, subTono: tono });
  if (estado === "Borrador") return resumen(PASOS_RECIBIDA, 0, null);
  return resumen(PASOS_RECIBIDA, 1, null, { subEtiqueta: sub, subTono: tono });
}

export function resumenDocumento(
  dominio: DocumentoDominio,
  input: EstadoRecibidaInput,
): EstadoDocumentoResumen {
  return dominio === "factura_emitida"
    ? resumenFacturaEmitida(input.estado)
    : resumenFacturaRecibida(input);
}


export { resumenProforma } from "@/lib/proformaEstados";
export type { EstadoProformaInput } from "@/lib/proformaEstados";
