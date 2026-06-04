/**
 * Lógica pura para construir la línea de tiempo de fases canónicas de un embarque:
 * Cotización → Confirmado → En Tránsito → Llegada → Cerrado.
 *
 * Sin dependencias de Supabase, React Query ni UI.
 */
import { calcularEstadoEmbarque } from "./embarque";

export type EstadoFase = "completada" | "actual" | "pendiente";

export type FaseId = "cotizacion" | "confirmado" | "en_transito" | "llegada" | "cerrado";

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

const ESTADOS_POST_TRANSITO = new Set([
  "En Tránsito",
  "Arribo",
  "En Aduana",
  "Entregado",
  "EIR",
  "Cerrado",
]);

const ESTADOS_POST_LLEGADA = new Set([
  "Arribo",
  "En Aduana",
  "Entregado",
  "EIR",
  "Cerrado",
]);

function faseIdParaEstado(estadoVisual: string): FaseId {
  if (estadoVisual === "Cerrado") return "cerrado";
  if (ESTADOS_POST_LLEGADA.has(estadoVisual)) return "llegada";
  if (estadoVisual === "En Tránsito") return "en_transito";
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
  );
  const faseActual = faseIdParaEstado(estadoVisual);
  const orden: FaseId[] = ["cotizacion", "confirmado", "en_transito", "llegada", "cerrado"];
  const idxActual = orden.indexOf(faseActual);

  const cotizacionCompletada = !!embarque.cotizacion_id;
  const transitoCompletada = ESTADOS_POST_TRANSITO.has(estadoVisual)
    || (!!embarque.etd && new Date(embarque.etd) <= startOfToday());
  const llegadaCompletada = !!embarque.fecha_llegada_real
    || ESTADOS_POST_LLEGADA.has(estadoVisual);
  const cerradoCompletada = estadoVisual === "Cerrado";

  const fases: FaseEmbarque[] = [
    {
      id: "cotizacion",
      label: "Cotización",
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
      id: "llegada",
      label: "Llegada",
      icono: "📍",
      fecha: embarque.fecha_llegada_real ?? embarque.eta,
      estado: llegadaCompletada ? "completada" : "pendiente",
    },
    {
      id: "cerrado",
      label: "Cerrado",
      icono: "🏁",
      fecha: cerradoCompletada ? embarque.updated_at : null,
      estado: cerradoCompletada ? "completada" : "pendiente",
    },
  ];

  // Marcar la fase actual: la última "completada" hasta el índice actual.
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
