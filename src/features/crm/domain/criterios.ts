/**
 * Dominio puro — criterios de salida por etapa y metas por oportunidad.
 * Sin I/O: sólo cálculo de avance, semáforo y comparación meta vs estimado.
 */

export interface AvanceCriterios {
  total: number;
  cumplidos: number;
  obligatoriosPendientes: number;
}

export type SemaforoCriterios = "sin_criterios" | "completo" | "incompleto";

/** Semáforo de la tarjeta: verde completo, ámbar incompleto. */
export function semaforoCriterios(avance: AvanceCriterios | undefined): SemaforoCriterios {
  if (!avance || avance.total === 0) return "sin_criterios";
  return avance.cumplidos >= avance.total ? "completo" : "incompleto";
}

/** Fracción cumplida (0–1). Sin criterios devuelve 0 para no inventar avance. */
export function porcentajeCriterios(avance: AvanceCriterios | undefined): number {
  if (!avance || avance.total <= 0) return 0;
  return Math.min(1, avance.cumplidos / avance.total);
}

/** Mensaje de advertencia al mover de etapa; `null` cuando no falta nada. */
export function avisoCriteriosPendientes(
  avance: AvanceCriterios | undefined,
  etapaNombre: string,
): string | null {
  if (!avance || avance.total === 0) return null;
  const pendientes = Math.max(0, avance.total - avance.cumplidos);
  if (pendientes === 0) return null;
  const obligatorios = avance.obligatoriosPendientes;
  const detalle = obligatorios > 0 ? ` (${obligatorios} obligatorio${obligatorios === 1 ? "" : "s"})` : "";
  return `Faltan ${pendientes} criterio${pendientes === 1 ? "" : "s"} de ${etapaNombre}${detalle}`;
}

export interface MetaOportunidad {
  montoEstimado: number;
  montoMeta: number | null;
  fechaMetaCierre: string | null;
  cerrada: boolean;
}

export interface EstadoMeta {
  /** Avance del estimado contra la meta (0–1+); `null` si no hay meta. */
  avance: number | null;
  /** La fecha meta ya pasó y la oportunidad sigue abierta. */
  metaVencida: boolean;
  tieneMeta: boolean;
}

/**
 * Compara estimado vs meta y detecta fecha meta vencida.
 * `hoyISO` se inyecta (YYYY-MM-DD) para mantener la función pura y testeable.
 */
export function estadoMeta(meta: MetaOportunidad, hoyISO: string): EstadoMeta {
  const montoMeta = meta.montoMeta != null ? Number(meta.montoMeta) : null;
  const tieneMeta = (montoMeta != null && montoMeta > 0) || !!meta.fechaMetaCierre;
  const avance =
    montoMeta != null && montoMeta > 0 ? Number(meta.montoEstimado) / montoMeta : null;
  const metaVencida = !!meta.fechaMetaCierre && !meta.cerrada && meta.fechaMetaCierre < hoyISO;
  return { avance, metaVencida, tieneMeta };
}

export interface TotalesEtapa {
  cantidad: number;
  estimado: number;
  meta: number;
  ponderado: number;
}

/** Suma estimado, meta y ponderado por probabilidad de un grupo de oportunidades. */
export function totalesEtapa(
  ops: { monto_estimado?: number | null; monto_meta?: number | null; probabilidad?: number | null }[],
): TotalesEtapa {
  return ops.reduce<TotalesEtapa>(
    (acc, o) => {
      const estimado = Number(o.monto_estimado ?? 0);
      return {
        cantidad: acc.cantidad + 1,
        estimado: acc.estimado + estimado,
        meta: acc.meta + Number(o.monto_meta ?? 0),
        ponderado: acc.ponderado + (estimado * Number(o.probabilidad ?? 0)) / 100,
      };
    },
    { cantidad: 0, estimado: 0, meta: 0, ponderado: 0 },
  );
}
