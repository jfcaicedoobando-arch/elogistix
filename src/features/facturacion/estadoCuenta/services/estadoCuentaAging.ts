/**
 * Agregados puros del Estado de Cuenta: antigüedad de saldos (aging),
 * saldo acumulado (running balance) y agrupación/subtotales por moneda.
 *
 * Sin I/O — todo se calcula sobre las filas ya cargadas para poder testearlo
 * de forma aislada (Power of 10).
 */
import { sumarMontos } from "@/lib/financial/financialUtils";
import type { FacturaEstadoCuenta } from "./estadoCuenta";
import type { Moneda } from "./estadoCuentaTypes";
import {
  bucketDeDias,
  CUBETAS_AGING,
  CUBETA_LABELS_LARGAS,
  type CubetaAging,
} from "@/lib/aging/buckets";

/**
 * Paso 6 de la auditoría: era un tercer catálogo de cubetas con rangos propios.
 * Ahora es un alias del catálogo único `src/lib/aging/buckets.ts`.
 */
export type BucketAging = CubetaAging;

export interface AgingBucket {
  id: BucketAging;
  label: string;
  mxn: number;
  usd: number;
  conteo: number;
}

export interface FilaEstadoCuenta extends FacturaEstadoCuenta {
  /** Saldo insoluto acumulado dentro de su moneda, en orden cronológico. */
  saldoAcumulado: number;
}

export interface GrupoMoneda {
  moneda: Moneda;
  filas: FilaEstadoCuenta[];
  cargos: number;
  abonos: number;
  saldo: number;
}

export type OrdenEstadoCuenta = "fecha" | "vencimiento" | "saldo";
export interface SortEstadoCuenta {
  key: OrdenEstadoCuenta;
  dir: "asc" | "desc";
}

const LABELS: Record<BucketAging, string> = CUBETA_LABELS_LARGAS;

export const BUCKETS_ORDEN: BucketAging[] = [...CUBETAS_AGING];

/** Bucket de antigüedad según días vencidos (0 = aún no vence). */
export const bucketDeFactura = bucketDeDias;

/** Aging por bucket y moneda, considerando sólo facturas con saldo vivo. */
export function calcularAging(rows: ReadonlyArray<FacturaEstadoCuenta>): AgingBucket[] {
  const acc = new Map<BucketAging, { mxn: number[]; usd: number[]; conteo: number }>();
  for (const id of BUCKETS_ORDEN) acc.set(id, { mxn: [], usd: [], conteo: 0 });

  for (const f of rows) {
    if (f.saldo <= 0.01) continue;
    const entry = acc.get(bucketDeFactura(f.dias_vencido));
    if (!entry) continue;
    entry.conteo += 1;
    if (f.moneda === "MXN") entry.mxn.push(f.saldo);
    else if (f.moneda === "USD") entry.usd.push(f.saldo);
  }

  return BUCKETS_ORDEN.map((id) => {
    const e = acc.get(id) ?? { mxn: [], usd: [], conteo: 0 };
    return { id, label: LABELS[id], mxn: sumarMontos(e.mxn), usd: sumarMontos(e.usd), conteo: e.conteo };
  });
}

function abonoDe(f: FacturaEstadoCuenta): number {
  return f.pagado + f.notas_credito_aplicadas;
}

function comparar(a: FacturaEstadoCuenta, b: FacturaEstadoCuenta, sort: SortEstadoCuenta): number {
  const signo = sort.dir === "asc" ? 1 : -1;
  if (sort.key === "saldo") return (a.saldo - b.saldo) * signo;
  const campo = sort.key === "vencimiento" ? "fecha_vencimiento" : "fecha_emision";
  return a[campo].localeCompare(b[campo]) * signo;
}

/**
 * Agrupa por moneda, calcula saldo acumulado (siempre en orden cronológico,
 * como un estado de cuenta contable) y devuelve subtotales por grupo.
 */
export function agruparPorMoneda(
  rows: ReadonlyArray<FacturaEstadoCuenta>,
  sort: SortEstadoCuenta,
): GrupoMoneda[] {
  const porMoneda = new Map<Moneda, FacturaEstadoCuenta[]>();
  for (const f of rows) {
    const lista = porMoneda.get(f.moneda);
    if (lista) lista.push(f);
    else porMoneda.set(f.moneda, [f]);
  }

  const grupos: GrupoMoneda[] = [];
  for (const [moneda, lista] of porMoneda) {
    const cronologico = [...lista].sort((a, b) => a.fecha_emision.localeCompare(b.fecha_emision));
    const acumulado = new Map<string, number>();
    let corriente = 0;
    for (const f of cronologico) {
      corriente = sumarMontos([corriente, f.saldo]);
      acumulado.set(f.id, corriente);
    }
    const filas = [...cronologico]
      .sort((a, b) => comparar(a, b, sort))
      .map((f) => ({ ...f, saldoAcumulado: acumulado.get(f.id) ?? 0 }));

    grupos.push({
      moneda,
      filas,
      cargos: sumarMontos(lista.map((f) => f.total)),
      abonos: sumarMontos(lista.map(abonoDe)),
      saldo: sumarMontos(lista.map((f) => f.saldo)),
    });
  }

  return grupos.sort((a, b) => a.moneda.localeCompare(b.moneda));
}
