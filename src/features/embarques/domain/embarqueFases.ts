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
import { calcularCompletadas, faseIdParaEstado } from "./embarqueFasesCompletitud";
import type {
  EmbarqueFasesInput,
  FaseEmbarque,
  FaseIconoId,
  FaseId,
} from "./embarqueFasesTipos";

export type {
  EstadoFase,
  FaseIconoId,
  FaseEmbarque,
  EmbarqueFasesInput,
} from "./embarqueFasesTipos";
export { esEmbarqueArribado, esEtaVencida } from "./embarqueEstadoTemporal";

function iconoTransito(modo: string): FaseIconoId {
  if (modo === "Aéreo") return "transito_aereo";
  if (modo === "Terrestre") return "transito_terrestre";
  return "transito_maritimo";
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

  // v13.492.0 — Un embarque en Borrador NO puede mostrar fases avanzadas como
  // completadas: antes la fase "Confirmado" venía tachada de fábrica y el ETD
  // vencido tachaba "En Tránsito", haciendo ver un borrador como confirmado.
  const esBorrador = embarque.estado === "Borrador";
  const done = calcularCompletadas(embarque, estadoVisual, esBorrador);

  const fases: FaseEmbarque[] = [
    {
      id: "cotizacion",
      label: "Propuesta",
      iconoId: "propuesta",
      fecha: cotizacionCreatedAt ?? null,
      estado: est(done.cotizacion),
    },
    {
      id: "confirmado",
      label: esBorrador ? "Por confirmar" : "Confirmado",
      iconoId: "confirmado",
      fecha: embarque.fecha_creacion,
      estado: est(!esBorrador),
    },

    {
      id: "en_transito",
      label: "En Tránsito",
      iconoId: iconoTransito(embarque.modo),
      fecha: embarque.etd,
      estado: est(done.transito),
    },
    {
      id: "arribo",
      label: "Arribo",
      iconoId: "arribo",
      fecha: embarque.fecha_llegada_real ?? embarque.eta,
      estado: est(done.arribo),
    },
    {
      id: "en_aduana",
      label: "En Aduana",
      iconoId: "aduana",
      fecha: null,
      estado: est(done.aduana),
    },
    {
      id: "entregado",
      label: "Entregado",
      iconoId: "entregado",
      fecha: null,
      estado: est(done.entregado),
    },
    {
      id: "eir",
      label: "EIR",
      iconoId: "eir",
      fecha: null,
      estado: est(done.eir),
    },
    {
      id: "por_liquidar",
      label: "Por liquidar",
      iconoId: "por_liquidar",
      fecha: null,
      estado: est(done.porLiquidar),
    },
    {
      id: "cerrado",
      label: "Cerrado",
      iconoId: "cerrado",
      fecha: done.cerrado ? embarque.updated_at : null,
      estado: est(done.cerrado),
    },
  ];

  // Marcar la fase actual: sobrescribe "completada" para el índice actual.
  if (idxActual >= 0) {
    fases[idxActual].estado = "actual";
  }

  return fases;
}

/**
 * Etiqueta del "siguiente paso" para la variante compacta (tab Resumen).
 *
 * v13.823.163 (smoke 162): en Borrador la fase actual es "Por confirmar", así
 * que anunciar "Siguiente: En Tránsito" contradecía el botón "Avanzar a
 * Confirmado". Ahora, mientras el embarque no está confirmado, el siguiente
 * paso que se anuncia es Confirmar. No cambia fases, fechas ni transiciones.
 */
export function etiquetaSiguientePaso(
  fases: FaseEmbarque[],
  idxActual: number,
): string | null {
  const actual = fases[idxActual];
  if (actual?.id === "confirmado" && actual.label === "Por confirmar") {
    return "Confirmar el embarque";
  }
  return fases[idxActual + 1]?.label ?? null;
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

/** Traduce el flag de completitud al estado de la fase. */
function est(completada: boolean): "completada" | "pendiente" {
  return completada ? "completada" : "pendiente";
}
