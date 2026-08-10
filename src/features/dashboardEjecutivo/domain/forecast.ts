/**
 * Cálculo de forecast multi-mes a partir de la serie EERR histórica.
 * Heurística inicial (v13.300.33):
 *   - Proyecta N meses (default 3) por delante usando promedio móvil de los
 *     últimos 3 meses de `ingresos` y `costos`.
 *   - Banda de confianza ±15% sobre el ingreso proyectado.
 *   - Si la historia tiene menos de 3 puntos, no proyecta (evita ruido).
 *
 * Función pura — sin I/O ni fetches. Fácil de testear.
 */
import type { PuntoEERR } from "@/features/dashboardEjecutivo/services";

export interface ForecastPoint {
  periodo: string;                 // "YYYY-MM"
  ingresos: number | null;         // real (null en meses proyectados)
  costos: number | null;           // real (null en meses proyectados)
  utilidad: number | null;         // real (null en meses proyectados)
  proyeccion: number | null;       // proyectado (null en meses reales)
  banda_min: number | null;
  banda_max: number | null;
  esProyeccion: boolean;
  /** Ola 4 · N46: el mes en curso es parcial (no cerrado). */
  esParcial: boolean;
}

const BANDA_PCT = 0.15;
const VENTANA = 3;

function siguienteMes(periodo: string): string {
  // periodo = "YYYY-MM"
  const [yStr, mStr] = periodo.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return periodo;
  const nextM = m === 12 ? 1 : m + 1;
  const nextY = m === 12 ? y + 1 : y;
  return `${nextY}-${String(nextM).padStart(2, "0")}`;
}

function promedio(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function computeForecast(
  historico: PuntoEERR[],
  mesesAdelante = 3,
  mesEnCurso?: string,
): ForecastPoint[] {
  const puntosReales: ForecastPoint[] = historico.map((p) => ({
    periodo: p.periodo,
    ingresos: p.ingresos,
    costos: p.costos,
    utilidad: p.utilidad,
    proyeccion: null,
    banda_min: null,
    banda_max: null,
    esProyeccion: false,
    esParcial: !!mesEnCurso && p.periodo === mesEnCurso,
  }));

  // Ola 4 · N46: el mes en curso está incompleto; promediarlo hunde el forecast.
  const completos = mesEnCurso ? historico.filter((p) => p.periodo !== mesEnCurso) : historico;
  if (completos.length < VENTANA || mesesAdelante <= 0) return puntosReales;

  const ultimos = completos.slice(-VENTANA);
  const avgIngresos = promedio(ultimos.map((p) => p.ingresos));

  let cursor = historico[historico.length - 1].periodo;
  const proyecciones: ForecastPoint[] = [];
  for (let i = 0; i < mesesAdelante; i++) {
    cursor = siguienteMes(cursor);
    proyecciones.push({
      periodo: cursor,
      ingresos: null,
      costos: null,
      utilidad: null,
      proyeccion: avgIngresos,
      banda_min: avgIngresos * (1 - BANDA_PCT),
      banda_max: avgIngresos * (1 + BANDA_PCT),
      esProyeccion: true,
      esParcial: false,
    });
  }

  return [...puntosReales, ...proyecciones];
}
