/**
 * Exportación (lógica pura) de la bitácora de tesorería a CSV y PDF.
 * v13.397.0
 *
 * Convierte las entradas de bitácora ya filtradas en filas legibles de negocio,
 * usando las mismas etiquetas que se muestran en pantalla.
 */
import { formatCurrency, formatDateTimeShort } from "@/lib/formatters";
import { toCsv } from "@/lib/csv/serializeCsv";

export interface EntradaBitacoraExport {
  accion: string;
  created_at: string;
  usuario_email: string;
  detalles?: Record<string, unknown> | null;
}

export interface FilaBitacoraExport {
  fecha: string;
  movimiento: string;
  monto: string;
  cargoMxn: string;
  cuenta: string;
  estadoMovimiento: string;
  usuario: string;
}

export const ENCABEZADOS_BITACORA_EXPORT = [
  "Fecha",
  "Movimiento",
  "Monto",
  "Cargo MXN",
  "Cuenta bancaria",
  "Estado del movimiento",
  "Usuario",
] as const;

const ACCION_LABELS: Record<string, string> = {
  pagar: "Pago registrado",
  editar_pago: "Pago editado",
  eliminar_pago: "Pago eliminado",
};

const ESTADO_MOVIMIENTO_LABELS: Record<string, string> = {
  creado: "Movimiento creado",
  dado_de_baja: "Movimiento dado de baja",
  no_creado: "Movimiento no generado",
  sin_cuenta: "Sin cuenta bancaria",
};

function num(d: Record<string, unknown>, k: string): number | null {
  const v = d[k];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function str(d: Record<string, unknown>, k: string): string | null {
  const v = d[k];
  return typeof v === "string" && v !== "" ? v : null;
}

export interface OpcionesFilasBitacora {
  monedaFactura: string;
  /** id de cuenta bancaria → nombre legible */
  nombreCuenta: Map<string, string>;
}

export function filasBitacoraExport(
  entradas: readonly EntradaBitacoraExport[],
  { monedaFactura, nombreCuenta }: OpcionesFilasBitacora,
): FilaBitacoraExport[] {
  return entradas.map((e) => {
    const d = e.detalles ?? {};
    const monto = num(d, "monto");
    const moneda = str(d, "moneda") ?? monedaFactura;
    const cargoMxn = num(d, "cargo_mxn");
    const cuentaId = str(d, "cuenta_bancaria_id");
    const estado = str(d, "movimiento_tesoreria");
    return {
      fecha: formatDateTimeShort(e.created_at),
      movimiento: ACCION_LABELS[e.accion] ?? e.accion,
      monto: monto !== null ? formatCurrency(monto, moneda) : "—",
      cargoMxn: cargoMxn !== null ? formatCurrency(cargoMxn, "MXN") : "—",
      cuenta: cuentaId ? (nombreCuenta.get(cuentaId) ?? "Cuenta bancaria") : "—",
      estadoMovimiento: estado ? (ESTADO_MOVIMIENTO_LABELS[estado] ?? estado) : "—",
      usuario: e.usuario_email || "—",
    };
  });
}

export function bitacoraExportACsv(filas: readonly FilaBitacoraExport[]): string {
  return toCsv(
    [...ENCABEZADOS_BITACORA_EXPORT],
    filas.map((f) => [
      f.fecha, f.movimiento, f.monto, f.cargoMxn, f.cuenta, f.estadoMovimiento, f.usuario,
    ]),
  );
}

/** Nombre de archivo: `bitacora-tesoreria-<folio>-<fecha>.<ext>`. */
export function nombreArchivoBitacora(folio: string, ext: "csv" | "pdf", hoy = new Date()): string {
  const folioLimpio = (folio || "factura")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  const fecha = [
    hoy.getFullYear(),
    String(hoy.getMonth() + 1).padStart(2, "0"),
    String(hoy.getDate()).padStart(2, "0"),
  ].join("-");
  return `bitacora-tesoreria-${folioLimpio}-${fecha}.${ext}`;
}
