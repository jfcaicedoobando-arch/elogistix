/**
 * Exportación (lógica pura) del libro maestro de pagos a CSV y PDF.
 */
import { formatCurrency, formatDate } from "@/lib/formatters";
import { toCsv } from "@/lib/csv/serializeCsv";
import {
  TIPO_PAGO_LABELS,
  type PagoLibro,
  type TotalesLibroPagos,
} from "@/features/tesoreria/domain/libroPagos";

export interface FilaLibroPagosExport {
  fecha: string;
  tipo: string;
  contraparte: string;
  documento: string;
  metodo: string;
  referencia: string;
  cuenta: string;
  monto: string;
  tipoCambio: string;
  fuenteTc: string;
  montoMxn: string;
  estado: string;
}

export const ENCABEZADOS_LIBRO_PAGOS = [
  "Fecha",
  "Tipo",
  "Contraparte",
  "Documento",
  "Método",
  "Referencia",
  "Cuenta",
  "Monto",
  "Tipo de cambio",
  "Fuente del TC",
  "Equivalente MXN",
  "Conciliación",
] as const;

function esMxn(moneda: string): boolean {
  return (moneda || "MXN").toUpperCase() === "MXN";
}

/**
 * Fuente del tipo de cambio del pago. Se conserva el TC con el que tesorería
 * registró el pago (así el reporte cuadra con lo asentado y con el banco).
 */
export function fuenteTcPago(p: Pick<PagoLibro, "moneda" | "tipo_cambio">): string {
  if (esMxn(p.moneda)) return "Moneda nacional";
  return p.tipo_cambio > 0 ? "TC registrado del pago (DOF de la fecha de pago)" : "Sin TC registrado";
}

export function filasLibroPagosExport(
  pagos: readonly PagoLibro[],
): FilaLibroPagosExport[] {
  return pagos.map((p) => ({
    fecha: formatDate(p.fecha),
    tipo: TIPO_PAGO_LABELS[p.tipo],
    contraparte: p.contraparte ?? "—",
    documento: p.documento_folio ?? "—",
    metodo: p.metodo_pago ?? "—",
    referencia: p.referencia ?? "—",
    cuenta: p.cuenta_alias ?? "—",
    monto: formatCurrency(p.monto, p.moneda),
    tipoCambio: esMxn(p.moneda) ? "1.0000" : (p.tipo_cambio || 0).toFixed(4),
    fuenteTc: fuenteTcPago(p),
    montoMxn: formatCurrency(p.monto_mxn, "MXN"),
    estado: p.conciliado ? "Conciliado" : "Pendiente",
  }));
}

export function libroPagosACsv(filas: readonly FilaLibroPagosExport[]): string {
  return toCsv(
    [...ENCABEZADOS_LIBRO_PAGOS],
    filas.map((f) => [
      f.fecha, f.tipo, f.contraparte, f.documento, f.metodo,
      f.referencia, f.cuenta, f.monto, f.tipoCambio, f.fuenteTc, f.montoMxn, f.estado,
    ]),
  );
}

/** Resumen del periodo, ya formateado, para encabezar el CSV/PDF. */
export function resumenLibroPagos(
  desde: string,
  hasta: string,
  totales: TotalesLibroPagos,
): { periodo: string; cobrado: string; pagado: string; neto: string; conteo: string } {
  return {
    periodo: `${formatDate(desde)} – ${formatDate(hasta)}`,
    cobrado: formatCurrency(totales.cobradoMxn, "MXN"),
    pagado: formatCurrency(totales.pagadoMxn, "MXN"),
    neto: formatCurrency(totales.netoMxn, "MXN"),
    conteo: String(totales.conteo),
  };
}

/** Nombre de archivo: `pagos-<desde>-<hasta>.<ext>`. */
export function nombreArchivoLibroPagos(
  desde: string,
  hasta: string,
  ext: "csv" | "pdf",
): string {
  return `pagos-${desde}-${hasta}.${ext}`;
}
