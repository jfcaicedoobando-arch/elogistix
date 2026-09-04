/**
 * Dominio puro — criterios de salida por etapa y metas por oportunidad.
 * Sin I/O: sólo cálculo de avance, semáforo y comparación meta vs estimado.
 */
import { agruparMontosPorMoneda } from "./montosPorMoneda";

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

export interface TotalesEtapaMoneda {
  moneda: string;
  estimado: number;
  meta: number;
  ponderado: number;
}

export interface TotalesEtapa {
  cantidad: number;
  /** Subtotales por moneda: nunca se suman MXN/USD/EUR entre sí (P1-CRM). */
  porMoneda: TotalesEtapaMoneda[];
}

interface OportunidadParaTotales {
  monto_estimado?: number | null;
  monto_meta?: number | null;
  probabilidad?: number | null;
  moneda?: string | null;
}

/** Suma estimado, meta y ponderado por probabilidad, agrupado por moneda. */
export function totalesEtapa(ops: OportunidadParaTotales[]): TotalesEtapa {
  const estimadoPorMoneda = agruparMontosPorMoneda(
    ops.map((o) => ({ monto: o.monto_estimado, moneda: o.moneda })),
  );
  const metaPorMoneda = agruparMontosPorMoneda(
    ops.map((o) => ({ monto: o.monto_meta, moneda: o.moneda })),
  );
  const ponderadoPorMoneda = agruparMontosPorMoneda(
    ops.map((o) => ({
      monto: (Number(o.monto_estimado ?? 0) * Number(o.probabilidad ?? 0)) / 100,
      moneda: o.moneda,
    })),
  );

  const monedas = new Set<string>([
    ...estimadoPorMoneda.keys(),
    ...metaPorMoneda.keys(),
    ...ponderadoPorMoneda.keys(),
  ]);

  const porMoneda = [...monedas]
    .sort((a, b) => a.localeCompare(b))
    .map((moneda) => ({
      moneda,
      estimado: estimadoPorMoneda.get(moneda) ?? 0,
      meta: metaPorMoneda.get(moneda) ?? 0,
      ponderado: ponderadoPorMoneda.get(moneda) ?? 0,
    }));

  return { cantidad: ops.length, porMoneda };
}
