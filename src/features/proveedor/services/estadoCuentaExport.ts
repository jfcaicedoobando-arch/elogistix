/**
 * Ola 2 — Filas formateadas del estado de cuenta del proveedor (CSV y PDF).
 * Lógica pura: no toca el DOM ni la red.
 */
import { toCsv } from "@/lib/csv/serializeCsv";
import { roundMoney } from "@/lib/financial/financialUtils";
import { formatDate } from "@/lib/formatters";
import {
  ETIQUETAS_BUCKET_PROVEEDOR,
  BUCKETS_AGING_PROVEEDOR,
  type AgingMonedaProveedor,
  type MovimientoConSaldo,
  type SaldoMonedaProveedor,
} from "@/features/proveedor/domain/movimientosProveedor";

export interface FilaMovimientoExport {
  fecha: string;
  tipo: string;
  folio: string;
  expediente: string;
  referencia: string;
  moneda: string;
  cargo: string;
  abono: string;
  saldo: string;
}

const num = (n: number): string => roundMoney(Number(n) || 0).toFixed(2);

export function filasMovimientosExport(
  movimientos: readonly MovimientoConSaldo[],
): FilaMovimientoExport[] {
  return movimientos.map((m) => ({
    fecha: (m.fecha || "").slice(0, 10),
    tipo: m.tipo,
    folio: m.folio,
    expediente: m.expediente || "",
    referencia: m.referencia || "",
    moneda: (m.moneda || "MXN").toUpperCase(),
    cargo: num(m.cargo),
    abono: num(m.abono),
    saldo: num(m.saldo),
  }));
}

export function filasAgingExport(
  aging: readonly AgingMonedaProveedor[],
): { moneda: string; etiqueta: string; saldo: string }[] {
  return aging.flatMap((a) =>
    BUCKETS_AGING_PROVEEDOR.map((b) => ({
      moneda: a.moneda,
      etiqueta: ETIQUETAS_BUCKET_PROVEEDOR[b],
      saldo: num(a.buckets[b] ?? 0),
    })),
  );
}

export function filasSaldosExport(
  saldos: readonly SaldoMonedaProveedor[],
): { moneda: string; cargos: string; abonos: string; saldo: string }[] {
  return saldos.map((s) => ({
    moneda: (s.moneda || "MXN").toUpperCase(),
    cargos: num(s.cargos),
    abonos: num(s.abonos),
    saldo: num(s.saldo),
  }));
}

/** CSV contable: encabezado con proveedor y periodo, detalle y totales. */
export function estadoCuentaACsv(
  proveedorNombre: string,
  periodo: { desde: string; hasta: string },
  movimientos: readonly FilaMovimientoExport[],
  saldos: readonly { moneda: string; cargos: string; abonos: string; saldo: string }[],
  aging: readonly { moneda: string; etiqueta: string; saldo: string }[] = [],
): string {
  const detalle = toCsv(
    ["Fecha", "Movimiento", "Folio", "Expediente", "Referencia", "Moneda", "Cargo", "Abono", "Saldo"],
    movimientos.map((m) => [
      m.fecha, m.tipo, m.folio, m.expediente, m.referencia, m.moneda, m.cargo, m.abono, m.saldo,
    ]),
  );
  const totales = toCsv(
    ["Moneda", "Cargos", "Abonos", "Saldo global"],
    saldos.map((s) => [s.moneda, s.cargos, s.abonos, s.saldo]),
  );
  // R3P-11: la antigüedad viaja en el CSV para soportar estados de cuenta sin
  // movimientos en el periodo (sólo saldo vencido).
  const antiguedad = toCsv(
    ["Moneda", "Antigüedad", "Saldo"],
    aging.map((a) => [a.moneda, a.etiqueta, a.saldo]),
  );
  const encabezado = toCsv(
    ["Proveedor", "Desde", "Hasta"],
    [[proveedorNombre, formatDate(periodo.desde), formatDate(periodo.hasta)]],
  );
  return `${encabezado}\n\n${detalle}\n\n${totales}\n\n${antiguedad}`;
}

export function nombreArchivoEstadoCuenta(
  proveedorNombre: string,
  hasta: string,
  ext: "csv" | "pdf",
): string {
  const slug = proveedorNombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 40);
  return `estado-cuenta-${slug || "proveedor"}-${hasta}.${ext}`;
}
