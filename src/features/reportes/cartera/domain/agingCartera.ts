/**
 * Dominio puro del reporte contable de Cartera y Antigüedad (CxC + CxP).
 *
 * Calcula cubetas de antigüedad contra una fecha de corte y valúa cada saldo
 * en pesos por dos vías: el TC histórico con el que se registró la factura y
 * el TC DOF de la fecha de corte (revaluación). La diferencia entre ambos es
 * la diferencia cambiaria del periodo.
 *
 * Sin red ni React.
 */

import {
  bucketDeDias,
  CUBETAS_AGING,
  CUBETA_LABELS_LARGAS,
  type CubetaAging,
} from "@/lib/aging/buckets";

/** Cubetas y etiquetas compartidas con `/cobranza/aging` y `/compras/aging`. */
export { bucketDeDias };
export const BUCKETS_AGING = CUBETAS_AGING;
export type BucketAging = CubetaAging;
export const BUCKET_AGING_LABELS = CUBETA_LABELS_LARGAS;

/** TC DOF usado para revaluar al corte. */
export interface TcCorte {
  usdMxn: number;
  eurMxn: number | null;
  /** Fecha de publicación DOF realmente usada. */
  fecha: string;
  /** `false` cuando se usó el último publicado antes de la fecha de corte. */
  exacto: boolean;
}

/** Factura pendiente, normalizada desde CxC o CxP. */
export interface FacturaCartera {
  id: string;
  folio: string;
  contraparte: string;
  expediente: string;
  moneda: string;
  /** Saldo pendiente en la moneda de la factura. */
  saldo: number;
  fechaEmision: string;
  fechaVencimiento: string | null;
  /** TC con el que se registró la factura (1 cuando es MXN). */
  tipoCambio: number;
}

export interface FilaCartera extends FacturaCartera {
  diasVencido: number;
  bucket: BucketAging;
  mxnHistorico: number;
  mxnCorte: number;
  diferencia: number;
}

export interface TotalesCartera {
  conteo: number;
  mxnHistorico: number;
  mxnCorte: number;
  diferencia: number;
}

export interface TotalBucket extends TotalesCartera {
  bucket: BucketAging;
}

function round2(n: number): number {
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
}

/** Días vencidos de una factura al corte (0 o negativo = aún no vence). */
export function diasVencidoAlCorte(
  fechaVencimiento: string | null,
  fechaCorte: string,
): number {
  if (!fechaVencimiento) return 0;
  const venc = Date.parse(`${fechaVencimiento}T00:00:00Z`);
  const corte = Date.parse(`${fechaCorte}T00:00:00Z`);
  if (Number.isNaN(venc) || Number.isNaN(corte)) return 0;
  return Math.round((corte - venc) / 86_400_000);
}

/** TC del corte aplicable a una moneda (1 para MXN, null si no hay dato). */
export function tcCorteDeMoneda(moneda: string, tc: TcCorte | null): number | null {
  const m = (moneda || "MXN").toUpperCase();
  if (m === "MXN") return 1;
  if (!tc) return null;
  if (m === "USD") return tc.usdMxn > 0 ? tc.usdMxn : null;
  if (m === "EUR") return tc.eurMxn && tc.eurMxn > 0 ? tc.eurMxn : null;
  return null;
}

/** Valúa una factura al histórico y al corte. */
export function valuarFactura(
  f: FacturaCartera,
  tc: TcCorte | null,
): { mxnHistorico: number; mxnCorte: number; diferencia: number } {
  const esMxn = (f.moneda || "MXN").toUpperCase() === "MXN";
  const tcAlCorte = tcCorteDeMoneda(f.moneda, tc);
  // Ola 4 · N47: sin TC histórico confiable no hay valuación histórica; se
  // reporta al TC del corte (si existe) en lugar de un falso 0.
  if (!esMxn && !(f.tipoCambio > 0)) {
    const mxn = tcAlCorte ? round2(f.saldo * tcAlCorte) : 0;
    return { mxnHistorico: mxn, mxnCorte: mxn, diferencia: 0 };
  }
  const tcHist = esMxn ? 1 : f.tipoCambio;
  const mxnHistorico = round2(f.saldo * tcHist);
  // Sin TC del corte disponible se conserva el histórico para no inventar cifras.
  const mxnCorte = round2(f.saldo * (tcAlCorte ?? tcHist));
  return { mxnHistorico, mxnCorte, diferencia: round2(mxnCorte - mxnHistorico) };
}

/** Filas del reporte: sólo facturas con saldo, ordenadas de más vencida a menos. */
export function construirFilasCartera(
  facturas: readonly FacturaCartera[],
  fechaCorte: string,
  tc: TcCorte | null,
): FilaCartera[] {
  return (facturas ?? [])
    .filter((f) => f.saldo > 0.01)
    .map((f) => {
      const diasVencido = diasVencidoAlCorte(f.fechaVencimiento, fechaCorte);
      return {
        ...f,
        diasVencido,
        bucket: bucketDeDias(diasVencido),
        ...valuarFactura(f, tc),
      };
    })
    .sort((a, b) => b.diasVencido - a.diasVencido);
}

function acumular(filas: readonly FilaCartera[]): TotalesCartera {
  return filas.reduce<TotalesCartera>(
    (acc, f) => ({
      conteo: acc.conteo + 1,
      mxnHistorico: round2(acc.mxnHistorico + f.mxnHistorico),
      mxnCorte: round2(acc.mxnCorte + f.mxnCorte),
      diferencia: round2(acc.diferencia + f.diferencia),
    }),
    { conteo: 0, mxnHistorico: 0, mxnCorte: 0, diferencia: 0 },
  );
}

/** Totales por cubeta, siempre en el mismo orden (incluye cubetas vacías). */
export function totalesPorBucket(filas: readonly FilaCartera[]): TotalBucket[] {
  return BUCKETS_AGING.map((bucket) => ({
    bucket,
    ...acumular(filas.filter((f) => f.bucket === bucket)),
  }));
}

/** Gran total del bloque (CxC o CxP). */
export function totalCartera(filas: readonly FilaCartera[]): TotalesCartera {
  return acumular(filas);
}

/** Leyenda del TC usado para el encabezado del reporte. */
export function leyendaTcCorte(tc: TcCorte | null): string {
  if (!tc) return "Sin TC DOF disponible — los montos en divisa se muestran al TC histórico.";
  const base = `TC DOF USD/MXN ${tc.usdMxn.toFixed(4)}`;
  return tc.exacto ? `${base} (publicado el día del corte)` : `${base} (último publicado: ${tc.fecha})`;
}
