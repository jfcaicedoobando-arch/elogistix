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
  /** IDs de pasos que se omitieron (nunca ocurrieron) y no deben verse como completados. */
  pasosOmitidos: string[];
}

interface ResumenOpciones {
  subEtiqueta?: string | null;
  subTono?: "warning" | "destructive";
  pasosOmitidos?: string[];
}

export function resumenDocumentoBase(
  pasos: PasoDocumento[],
  indiceActual: number,
  etiquetaTerminal: string | null,
  opciones: ResumenOpciones = {},
): EstadoDocumentoResumen {
  const { subEtiqueta = null, subTono = "warning", pasosOmitidos = [] } = opciones;
  return {
    pasos,
    indiceActual: etiquetaTerminal ? -1 : indiceActual,
    terminal: !!etiquetaTerminal,
    etiquetaTerminal,
    subEtiqueta: etiquetaTerminal ? null : subEtiqueta,
    subTono,
    pasosOmitidos: etiquetaTerminal ? [] : pasosOmitidos,
  };
}
