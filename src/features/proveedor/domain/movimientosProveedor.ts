/**
 * Ola 2 — Estado de cuenta cronológico del proveedor.
 *
 * Analogía: es el "estado de cuenta bancario" del proveedor. Cada factura suya
 * es un cargo (le debemos más) y cada pago o nota de crédito es un abono (le
 * debemos menos). El saldo corrido se calcula por moneda: nunca se suman pesos
 * con dólares.
 *
 * La RPC `public.proveedor_estado_cuenta_movimientos` alimenta estos tipos.
 */
import { roundMoney } from "@/lib/financial/financialUtils";

export type TipoMovimientoProveedor =
  | "Factura"
  | "Nota de crédito"
  | "Pago"
  | "Anticipo aplicado"
  | "Anticipo";

export interface MovimientoProveedor {
  fecha: string;
  tipo: TipoMovimientoProveedor;
  ref_id: string;
  folio: string;
  referencia: string | null;
  expediente: string;
  embarque_id: string | null;
  moneda: string;
  cargo: number;
  abono: number;
  detalle: string | null;
}

/** Movimiento con el saldo acumulado de su propia moneda. */
export interface MovimientoConSaldo extends MovimientoProveedor {
  saldo: number;
}

export type BucketAgingProveedor = "Vigente" | "1-30" | "31-60" | "61-90" | "90+";

export const BUCKETS_AGING_PROVEEDOR: readonly BucketAgingProveedor[] = [
  "Vigente",
  "1-30",
  "31-60",
  "61-90",
  "90+",
] as const;

export const ETIQUETAS_BUCKET_PROVEEDOR: Record<BucketAgingProveedor, string> = {
  Vigente: "Por vencer",
  "1-30": "1 a 30 días",
  "31-60": "31 a 60 días",
  "61-90": "61 a 90 días",
  "90+": "Más de 90 días",
};

export interface AgingFilaProveedor {
  moneda: string;
  bucket: BucketAgingProveedor;
  saldo: number;
  conteo: number;
}

export interface SaldoMonedaProveedor {
  moneda: string;
  cargos: number;
  abonos: number;
  saldo: number;
}

export interface EstadoCuentaMovimientos {
  movimientos: MovimientoProveedor[];
  aging: AgingFilaProveedor[];
  saldos: SaldoMonedaProveedor[];
  /** Total de movimientos del periodo ANTES del límite server-side (R3FE-04). */
  total_movimientos: number;
  /** true = el periodo tiene más movimientos de los devueltos (truncado). */
  hay_mas: boolean;
}

/** Antigüedad de una moneda, ya distribuida en cubetas y con su total. */
export interface AgingMonedaProveedor {
  moneda: string;
  buckets: Record<BucketAgingProveedor, number>;
  conteo: number;
  total: number;
  vencido: number;
}

const vacio = (): Record<BucketAgingProveedor, number> => ({
  Vigente: 0,
  "1-30": 0,
  "31-60": 0,
  "61-90": 0,
  "90+": 0,
});

/**
 * Saldo corrido por moneda, respetando el orden cronológico recibido.
 * No mezcla divisas: cada moneda arranca su propio acumulado en cero.
 */
export function conSaldoCorrido(
  movimientos: readonly MovimientoProveedor[],
): MovimientoConSaldo[] {
  const acumulado = new Map<string, number>();
  return movimientos.map((m) => {
    const moneda = (m.moneda || "MXN").toUpperCase();
    const previo = acumulado.get(moneda) ?? 0;
    const saldo = roundMoney(previo + (Number(m.cargo) || 0) - (Number(m.abono) || 0));
    acumulado.set(moneda, saldo);
    return { ...m, saldo };
  });
}

/** Agrupa las filas de antigüedad por moneda para pintarlas como matriz. */
export function agingPorMoneda(
  filas: readonly AgingFilaProveedor[],
): AgingMonedaProveedor[] {
  const mapa = new Map<string, AgingMonedaProveedor>();
  for (const f of filas) {
    const moneda = (f.moneda || "MXN").toUpperCase();
    const actual =
      mapa.get(moneda) ?? { moneda, buckets: vacio(), conteo: 0, total: 0, vencido: 0 };
    const saldo = Number(f.saldo) || 0;
    actual.buckets[f.bucket] = roundMoney((actual.buckets[f.bucket] ?? 0) + saldo);
    actual.conteo += Number(f.conteo) || 0;
    actual.total = roundMoney(actual.total + saldo);
    if (f.bucket !== "Vigente") actual.vencido = roundMoney(actual.vencido + saldo);
    mapa.set(moneda, actual);
  }
  return [...mapa.values()].sort((a, b) => a.moneda.localeCompare(b.moneda));
}

/** Filtra movimientos por rango de fechas (inclusivo, formato ISO yyyy-MM-dd). */
export function filtrarPorRango(
  movimientos: readonly MovimientoProveedor[],
  desde: string,
  hasta: string,
): MovimientoProveedor[] {
  return movimientos.filter((m) => {
    const f = (m.fecha || "").slice(0, 10);
    if (!f) return false;
    if (desde && f < desde) return false;
    if (hasta && f > hasta) return false;
    return true;
  });
}
