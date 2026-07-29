/**
 * Dominio puro: revalidación de tarifa al convertir cotización → embarque.
 *
 * No depende de Supabase ni React. Toda la matemática y la clasificación de
 * severidad vive aquí para ser testeable de forma aislada.
 */
import { roundMoney } from "@/lib/financial/financialUtils";

export type SeveridadRevalidacion = "sin_cambios" | "informativa" | "bloqueante";

export type DecisionTarifa =
  | "sin_cambios"
  | "mantenida_por_operaciones"
  | "refrescada"
  | "sustituida"
  | "reaprobada_ventas";

export interface CambioTarifa {
  concepto: string;
  moneda: "USD" | "MXN";
  monto_anterior: number;
  monto_actual: number | null;
  delta_abs: number | null;
  delta_pct: number | null;
  motivo?: "eliminado";
}

export interface ResultadoRevalidacion {
  tarifa_vigente: boolean;
  agente_sin_cupo: boolean;
  severidad: SeveridadRevalidacion;
  cambios: CambioTarifa[];
  umbral_pct: number;
  max_delta_pct: number;
  tarifa_id_vigente?: string | null;
  motivo?: string;
}

export class RevalidacionRequeridaError extends Error {
  readonly resultado: ResultadoRevalidacion;
  constructor(resultado: ResultadoRevalidacion, message?: string) {
    super(
      message ??
        `La tarifa de la cotización requiere revisión (severidad: ${resultado.severidad}).`,
    );
    this.name = "RevalidacionRequeridaError";
    this.resultado = resultado;
  }
}

/** % absoluto del cambio. anterior=0 → 0 si actual=0, sino 100. */
export function calcularDeltaPct(anterior: number, actual: number): number {
  if (anterior === 0) return actual === 0 ? 0 : 100;
  return roundMoney((Math.abs(actual - anterior) / Math.abs(anterior)) * 100);
}

/**
 * Clasifica la severidad combinando: tarifa vencida, política de bloqueo,
 * lista de cambios detectados y umbral configurado.
 */
export function clasificarSeveridad(
  cambios: CambioTarifa[],
  umbralPct: number,
  tarifaVigente: boolean,
  bloqueaSiVencida: boolean,
): SeveridadRevalidacion {
  if (!tarifaVigente && bloqueaSiVencida) return "bloqueante";
  if (cambios.length === 0 && tarifaVigente) return "sin_cambios";
  const maxDelta = cambios.reduce<number>(
    (acc, c) => (c.delta_pct == null ? 100 : Math.max(acc, c.delta_pct)),
    0,
  );
  if (maxDelta > umbralPct) return "bloqueante";
  return "informativa";
}

/** Resume el delta por moneda — útil para bitácora y notificaciones. */
export function resumirDelta(cambios: CambioTarifa[]): {
  total_usd: number;
  total_mxn: number;
  conceptos: number;
} {
  let total_usd = 0;
  let total_mxn = 0;
  for (const c of cambios) {
    const d = c.delta_abs ?? 0;
    if (c.moneda === "USD") total_usd += d;
    else total_mxn += d;
  }
  return {
    total_usd: roundMoney(total_usd),
    total_mxn: roundMoney(total_mxn),
    conceptos: cambios.length,
  };
}
