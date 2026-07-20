/**
 * Lógica pura para construir la línea de tiempo de fases canónicas de un
 * embarque (v13.303.22):
 * Propuesta (origen COT) → Confirmado → En Tránsito → Arribo → En Aduana →
 * Entregado → EIR → Cerrado.
 *
 * Sin dependencias de Supabase, React Query ni UI.
 */
import { calcularEstadoEmbarque } from "./embarque";

export type EstadoFase = "completada" | "actual" | "pendiente";

export type FaseId =
  | "cotizacion"
  | "confirmado"
  | "en_transito"
  | "arribo"
  | "en_aduana"
  | "entregado"
  | "eir"
  | "cerrado";

export interface FaseEmbarque {
  id: FaseId;
  label: string;
  icono: string;
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

// v13.303.22 — Rankings en base al nuevo orden Arribo → En Aduana → Entregado
// → EIR → Cerrado. Cada set representa "estados iguales o posteriores a".
const ESTADOS_POST_TRANSITO = new Set([
  "En Tránsito", "Arribo", "En Aduana", "Llegada", "Entregado", "EIR", "Cerrado",
]);
const ESTADOS_POST_ARRIBO = new Set([
  "Arribo", "En Aduana", "Llegada", "Entregado", "EIR", "Cerrado",
]);
const ESTADOS_POST_ADUANA = new Set([
  "En Aduana", "Entregado", "EIR", "Cerrado",
]);
const ESTADOS_POST_ENTREGADO = new Set(["Entregado", "EIR", "Cerrado"]);
const ESTADOS_POST_EIR = new Set(["EIR", "Cerrado"]);

function faseIdParaEstado(estadoVisual: string): FaseId {
  if (estadoVisual === "Cerrado") return "cerrado";
  if (estadoVisual === "EIR") return "eir";
  if (estadoVisual === "Entregado") return "entregado";
  if (estadoVisual === "En Aduana") return "en_aduana";
  // "Llegada" (deprecado) y "Arribo" se agrupan en la fase de Arribo.
  if (estadoVisual === "Arribo" || estadoVisual === "Llegada") return "arribo";
  if (estadoVisual === "En Tránsito") return "en_transito";
  if (estadoVisual === "Confirmado") return "confirmado";
  return "confirmado";
}

export function calcularFasesEmbarque(
  embarque: EmbarqueFasesInput,
  cotizacionCreatedAt?: string | null,
): FaseEmbarque[] {
  const estadoVisual = calcularEstadoEmbarque(
    embarque.modo,
    embarque.tipo,
    embarque.etd,
    embarque.eta,
    embarque.estado,
    embarque.fecha_llegada_real,
  );
  const faseActual = faseIdParaEstado(estadoVisual);
  const orden: FaseId[] = [
    "cotizacion", "confirmado", "en_transito",
    "arribo", "en_aduana", "entregado", "eir", "cerrado",
  ];
  const idxActual = orden.indexOf(faseActual);

  const cotizacionCompletada = !!embarque.cotizacion_id;
  const transitoCompletada = ESTADOS_POST_TRANSITO.has(estadoVisual)
    || (!!embarque.etd && new Date(embarque.etd) <= startOfToday());
  const arriboCompletada = !!embarque.fecha_llegada_real
    || ESTADOS_POST_ARRIBO.has(estadoVisual);
  const aduanaCompletada = ESTADOS_POST_ADUANA.has(estadoVisual);
  const entregadoCompletada = ESTADOS_POST_ENTREGADO.has(estadoVisual);
  const eirCompletada = ESTADOS_POST_EIR.has(estadoVisual);
  const cerradoCompletada = estadoVisual === "Cerrado";

  const fases: FaseEmbarque[] = [
    {
      id: "cotizacion",
      label: "Propuesta",
      icono: "📝",
      fecha: cotizacionCreatedAt ?? null,
      estado: cotizacionCompletada ? "completada" : "pendiente",
    },
    {
      id: "confirmado",
      label: "Confirmado",
      icono: "✅",
      fecha: embarque.fecha_creacion,
      estado: "completada",
    },
    {
      id: "en_transito",
      label: "En Tránsito",
      icono: "🚢",
      fecha: embarque.etd,
      estado: transitoCompletada ? "completada" : "pendiente",
    },
    {
      id: "arribo",
      label: "Arribo",
      icono: "⚓",
      fecha: embarque.fecha_llegada_real ?? embarque.eta,
      estado: arriboCompletada ? "completada" : "pendiente",
    },
    {
      id: "en_aduana",
      label: "En Aduana",
      icono: "🛃",
      fecha: null,
      estado: aduanaCompletada ? "completada" : "pendiente",
    },
    {
      id: "entregado",
      label: "Entregado",
      icono: "📦",
      fecha: null,
      estado: entregadoCompletada ? "completada" : "pendiente",
    },
    {
      id: "eir",
      label: "EIR",
      icono: "📄",
      fecha: null,
      estado: eirCompletada ? "completada" : "pendiente",
    },
    {
      id: "cerrado",
      label: "Cerrado",
      icono: "🏁",
      fecha: cerradoCompletada ? embarque.updated_at : null,
      estado: cerradoCompletada ? "completada" : "pendiente",
    },
  ];

  // Marcar la fase actual: sobrescribe "completada" para el índice actual.
  if (idxActual >= 0) {
    fases[idxActual].estado = "actual";
  }

  return fases;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
