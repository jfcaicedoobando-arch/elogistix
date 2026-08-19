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
import {
  CUBETAS_WIRE_PROVEEDOR,
  CUBETA_WIRE_LABELS_PROVEEDOR,
  CUBETA_WIRE_PROVEEDOR,
  type CubetaWireProveedor,
} from "@/lib/aging/buckets";

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

/**
 * Paso 6 de la auditoría: las cubetas ya NO se declaran aquí. Se derivan del
 * catálogo único `src/lib/aging/buckets.ts`, igual que las de cartera (CxC),
 * para que un cambio de rangos o etiquetas se aplique en un solo lugar.
 */
export type BucketAgingProveedor = CubetaWireProveedor;

export const BUCKETS_AGING_PROVEEDOR: readonly BucketAgingProveedor[] = CUBETAS_WIRE_PROVEEDOR;

export const ETIQUETAS_BUCKET_PROVEEDOR: Record<BucketAgingProveedor, string> =
  CUBETA_WIRE_LABELS_PROVEEDOR;

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

/** Ola 12 · R3FE-03: saldo de apertura de una moneda (previo al periodo). */
export interface SaldoAperturaProveedor {
  moneda: string;
  saldo: number;
}

export interface EstadoCuentaMovimientos {
  movimientos: MovimientoProveedor[];
  saldo_apertura: SaldoAperturaProveedor[];
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

const vacio = (): Record<BucketAgingProveedor, number> =>
  Object.fromEntries(BUCKETS_AGING_PROVEEDOR.map((b) => [b, 0])) as Record<
    BucketAgingProveedor,
    number
  >;

/**
 * Saldo corrido por moneda, respetando el orden cronológico recibido.
 * No mezcla divisas: cada moneda arranca su propio acumulado en el saldo de
 * apertura del periodo (Ola 12 · R3FE-03; cero si la RPC no lo trae).
 */
export function conSaldoCorrido(
  movimientos: readonly MovimientoProveedor[],
  apertura: readonly SaldoAperturaProveedor[] = [],
): MovimientoConSaldo[] {
  const acumulado = new Map<string, number>();
  for (const a of apertura) {
    const moneda = (a.moneda || "MXN").toUpperCase();
    acumulado.set(moneda, roundMoney(Number(a.saldo) || 0));
  }
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
    if (f.bucket !== CUBETA_WIRE_PROVEEDOR.vigente) actual.vencido = roundMoney(actual.vencido + saldo);
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
