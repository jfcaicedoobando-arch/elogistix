/**
 * Normalización y exportación (CSV/PDF) del reporte de Cartera y Antigüedad.
 * Convierte las facturas de CxC y CxP al modelo del dominio y arma las filas
 * ya formateadas que consumen el CSV contable y el documento PDF.
 */
import { formatCurrency, formatDate } from "@/lib/formatters";
import { toCsv } from "@/lib/csv/serializeCsv";
import type { FacturaCobranza } from "@/features/facturacion/services";
import type { FacturaCxP } from "@/features/cxp/services";
import {
  BUCKET_AGING_LABELS,
  type FacturaCartera,
  type FilaCartera,
  type TotalBucket,
  type TotalesCartera,
} from "@/features/reportes/cartera/domain/agingCartera";

/** CxC → modelo del reporte. */
export function facturasCarteraDeCobranza(
  rows: readonly FacturaCobranza[],
): FacturaCartera[] {
  return (rows ?? []).map((r) => ({
    id: r.id,
    folio: r.numero,
    contraparte: r.cliente_nombre,
    expediente: r.expediente ?? "",
    moneda: r.moneda,
    saldo: Number(r.saldo ?? 0),
    fechaEmision: r.fecha_emision,
    fechaVencimiento: r.fecha_vencimiento ?? null,
    tipoCambio: Number(r.tipo_cambio ?? 0),
  }));
}

/** CxP → modelo del reporte. */
export function facturasCarteraDeCxp(rows: readonly FacturaCxP[]): FacturaCartera[] {
  return (rows ?? []).map((r) => ({
    id: r.id,
    folio: r.folio_interno || r.folio_proveedor,
    contraparte: r.proveedor_nombre,
    expediente: r.embarque_expediente ?? "",
    moneda: r.moneda,
    saldo: Number(r.saldo ?? 0),
    fechaEmision: r.fecha_emision,
    fechaVencimiento: r.fecha_vencimiento ?? null,
    tipoCambio: Number(r.tipo_cambio_usd ?? 0),
  }));
}

/** Fila de factura ya formateada (contrato compartido CSV/PDF). */
export interface FilaCarteraExport {
  bloque: string;
  contraparte: string;
  folio: string;
  expediente: string;
  emision: string;
  vencimiento: string;
  dias: string;
  bucket: string;
  moneda: string;
  saldo: string;
  mxnHistorico: string;
  mxnCorte: string;
  diferencia: string;
}

/** Fila de totales (por cubeta o gran total) ya formateada. */
export interface FilaTotalExport {
  etiqueta: string;
  conteo: string;
  mxnHistorico: string;
  mxnCorte: string;
  diferencia: string;
}

export const ENCABEZADOS_CARTERA = [
  "Bloque",
  "Cliente / Proveedor",
  "Folio",
  "Expediente",
  "Emisión",
  "Vencimiento",
  "Días vencido",
  "Antigüedad",
  "Moneda",
  "Saldo",
  "MXN histórico",
  "MXN al corte",
  "Diferencia cambiaria",
] as const;

function num(n: number): string {
  return (Number.isFinite(n) ? n : 0).toFixed(2);
}

export function filasCarteraExport(
  bloque: string,
  filas: readonly FilaCartera[],
): FilaCarteraExport[] {
  return filas.map((f) => ({
    bloque,
    contraparte: f.contraparte,
    folio: f.folio,
    expediente: f.expediente || "—",
    emision: formatDate(f.fechaEmision),
    vencimiento: f.fechaVencimiento ? formatDate(f.fechaVencimiento) : "—",
    dias: String(f.diasVencido > 0 ? f.diasVencido : 0),
    bucket: BUCKET_AGING_LABELS[f.bucket],
    moneda: f.moneda,
    saldo: num(f.saldo),
    mxnHistorico: num(f.mxnHistorico),
    mxnCorte: num(f.mxnCorte),
    diferencia: num(f.diferencia),
  }));
}

export function filasTotalesExport(
  buckets: readonly TotalBucket[],
  total: TotalesCartera,
  bloque: string,
): FilaTotalExport[] {
  const porBucket = buckets.map((b) => ({
    etiqueta: BUCKET_AGING_LABELS[b.bucket],
    conteo: String(b.conteo),
    mxnHistorico: num(b.mxnHistorico),
    mxnCorte: num(b.mxnCorte),
    diferencia: num(b.diferencia),
  }));
  return [
    ...porBucket,
    {
      etiqueta: `Total ${bloque}`,
      conteo: String(total.conteo),
      mxnHistorico: num(total.mxnHistorico),
      mxnCorte: num(total.mxnCorte),
      diferencia: num(total.diferencia),
    },
  ];
}

/** CSV contable: detalle de ambos bloques + filas de totales por cubeta. */
export function carteraACsv(
  detalle: readonly FilaCarteraExport[],
  totales: readonly { bloque: string; filas: readonly FilaTotalExport[] }[],
): string {
  const filasDetalle = detalle.map((f) => [
    f.bloque, f.contraparte, f.folio, f.expediente, f.emision, f.vencimiento,
    f.dias, f.bucket, f.moneda, f.saldo, f.mxnHistorico, f.mxnCorte, f.diferencia,
  ]);
  const filasTotales = totales.flatMap((t) =>
    t.filas.map((f) => [
      `TOTALES ${t.bloque}`, "", "", "", "", "", "", f.etiqueta, "MXN",
      "", f.mxnHistorico, f.mxnCorte, f.diferencia,
    ]),
  );
  return toCsv([...ENCABEZADOS_CARTERA], [...filasDetalle, ...filasTotales]);
}

/** Resumen formateado para encabezar el PDF. */
export function resumenCarteraPdf(total: TotalesCartera) {
  return {
    conteo: String(total.conteo),
    mxnHistorico: formatCurrency(total.mxnHistorico, "MXN"),
    mxnCorte: formatCurrency(total.mxnCorte, "MXN"),
    diferencia: formatCurrency(total.diferencia, "MXN"),
  };
}

/** Nombre de archivo: `cartera-antiguedad-<corte>.<ext>`. */
export function nombreArchivoCartera(fechaCorte: string, ext: "csv" | "pdf"): string {
  return `cartera-antiguedad-${fechaCorte}.${ext}`;
}
