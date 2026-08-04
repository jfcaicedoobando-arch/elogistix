/**
 * Lógica pura para construir la línea de tiempo de fases canónicas de un
 * embarque (v13.380.0):
 * Propuesta (origen COT) → Confirmado → En Tránsito → Arribo → En Aduana →
 * Entregado → EIR → Por liquidar → Cerrado.
 *
 * Sin dependencias de Supabase, React Query ni UI.
 * v13.380.2 — tipos y helpers temporales se movieron a `embarqueFasesTipos.ts`
 * y `embarqueEstadoTemporal.ts`; aquí se re-exportan por compatibilidad.
 */
import { calcularEstadoEmbarque } from "./embarque";
import type {
  EmbarqueFasesInput,
  FaseEmbarque,
  FaseIconoId,
  FaseId,
} from "./embarqueFasesTipos";

export type {
  EstadoFase,
  FaseId,
  FaseIconoId,
  FaseEmbarque,
  EmbarqueFasesInput,
  EmbarqueEstadoTemporalInput,
} from "./embarqueFasesTipos";
export { esEmbarqueArribado, esEtaVencida } from "./embarqueEstadoTemporal";

function iconoTransito(modo: string): FaseIconoId {
  if (modo === "Aéreo") return "transito_aereo";
  if (modo === "Terrestre") return "transito_terrestre";
  return "transito_maritimo";
}



// v13.380.0 — Orden: Arribo → En Aduana → Entregado → EIR → Por liquidar →
// Cerrado. Cada set representa "estados iguales o posteriores a".
const ESTADOS_POST_TRANSITO = new Set([
  "En Tránsito", "Arribo", "En Aduana", "Llegada", "Entregado", "EIR", "Por liquidar", "Cerrado",
]);
const ESTADOS_POST_ARRIBO = new Set([
  "Arribo", "En Aduana", "Llegada", "Entregado", "EIR", "Por liquidar", "Cerrado",
]);
const ESTADOS_POST_ADUANA = new Set([
  "En Aduana", "Entregado", "EIR", "Por liquidar", "Cerrado",
]);
const ESTADOS_POST_ENTREGADO = new Set(["Entregado", "EIR", "Por liquidar", "Cerrado"]);
const ESTADOS_POST_EIR = new Set(["EIR", "Por liquidar", "Cerrado"]);
const ESTADOS_POST_POR_LIQUIDAR = new Set(["Por liquidar", "Cerrado"]);

function faseIdParaEstado(estadoVisual: string): FaseId {
  if (estadoVisual === "Cerrado") return "cerrado";
  if (estadoVisual === "Por liquidar") return "por_liquidar";
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
    "arribo", "en_aduana", "entregado", "eir", "por_liquidar", "cerrado",
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
  const porLiquidarCompletada = ESTADOS_POST_POR_LIQUIDAR.has(estadoVisual);
  const cerradoCompletada = estadoVisual === "Cerrado";

  const fases: FaseEmbarque[] = [
    {
      id: "cotizacion",
      label: "Propuesta",
      iconoId: "propuesta",
      fecha: cotizacionCreatedAt ?? null,
      estado: cotizacionCompletada ? "completada" : "pendiente",
    },
    {
      id: "confirmado",
      label: "Confirmado",
      iconoId: "confirmado",
      fecha: embarque.fecha_creacion,
      estado: "completada",
    },
    {
      id: "en_transito",
      label: "En Tránsito",
      iconoId: iconoTransito(embarque.modo),
      fecha: embarque.etd,
      estado: transitoCompletada ? "completada" : "pendiente",
    },
    {
      id: "arribo",
      label: "Arribo",
      iconoId: "arribo",
      fecha: embarque.fecha_llegada_real ?? embarque.eta,
      estado: arriboCompletada ? "completada" : "pendiente",
    },
    {
      id: "en_aduana",
      label: "En Aduana",
      iconoId: "aduana",
      fecha: null,
      estado: aduanaCompletada ? "completada" : "pendiente",
    },
    {
      id: "entregado",
      label: "Entregado",
      iconoId: "entregado",
      fecha: null,
      estado: entregadoCompletada ? "completada" : "pendiente",
    },
    {
      id: "eir",
      label: "EIR",
      iconoId: "eir",
      fecha: null,
      estado: eirCompletada ? "completada" : "pendiente",
    },
    {
      id: "por_liquidar",
      label: "Por liquidar",
      iconoId: "por_liquidar",
      fecha: null,
      estado: porLiquidarCompletada ? "completada" : "pendiente",
    },
    {
      id: "cerrado",
      label: "Cerrado",
      iconoId: "cerrado",
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

/**
 * Detecta si las fechas de las fases (en orden canónico) están fuera de
 * secuencia cronológica. Ignora fases sin fecha capturada. Uso puramente
 * informativo: no bloquea ninguna acción, sólo dispara un aviso discreto en
 * el stepper para que se revise la bitácora.
 */
export function hayFechasFueraDeOrden(fases: FaseEmbarque[]): boolean {
  let anterior: number | null = null;
  for (const fase of fases) {
    if (!fase.fecha) continue;
    const t = new Date(fase.fecha).getTime();
    if (Number.isNaN(t)) continue;
    if (anterior !== null && t < anterior) return true;
    anterior = t;
  }
  return false;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
