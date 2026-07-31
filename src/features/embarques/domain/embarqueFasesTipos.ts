/**
 * Tipos del dominio de fases de embarque (extraídos de `embarqueFases.ts`
 * en v13.380.2 para respetar el límite de 200 líneas por archivo).
 */
export type EstadoFase = "completada" | "actual" | "pendiente";

export type FaseId =
  | "cotizacion"
  | "confirmado"
  | "en_transito"
  | "arribo"
  | "en_aduana"
  | "entregado"
  | "eir"
  | "por_liquidar"
  | "cerrado";

/**
 * Identificador neutro de icono por fase. El dominio no conoce componentes de
 * UI: la capa de presentación resuelve el icono Lucide correspondiente.
 */
export type FaseIconoId =
  | "propuesta"
  | "confirmado"
  | "transito_maritimo"
  | "transito_aereo"
  | "transito_terrestre"
  | "arribo"
  | "aduana"
  | "entregado"
  | "eir"
  | "por_liquidar"
  | "cerrado";

export interface FaseEmbarque {
  id: FaseId;
  label: string;
  /** Identificador de icono (resuelto a Lucide en la UI). */
  iconoId: FaseIconoId;
  fecha: string | null;
  estado: EstadoFase;
}

export interface EmbarqueFasesInput {
  modo: string;
  tipo: string;
  estado: string;
  etd: string | null;
  eta: string | null;
  fecha_creacion: string;
  fecha_llegada_real: string | null;
  cotizacion_id: string | null;
  updated_at: string;
}

/** Campos mínimos para evaluar arribo / vencimiento de ETA. */
export interface EmbarqueEstadoTemporalInput {
  estado: string;
  eta: string | null;
  fecha_llegada_real: string | null;
}
