/**
 * Construcción del CSV de "Hueco de Facturación".
 * Lógica pura extraída de `useHuecoFacturacion` para permitir tests sin
 * acoplarse a React Query.
 */
import type { FilaHueco } from "@/features/facturacion/services";
import { formatDate } from "@/lib/formatters";
import { hoyMx } from "@/lib/date/mx";

export const HUECO_CSV_HEADERS = [
  { key: "expediente", label: "Expediente" },
  { key: "cliente", label: "Cliente" },
  { key: "operador", label: "Operador" },
  { key: "etd", label: "ETD" },
  { key: "eta", label: "ETA" },
  { key: "bl_master", label: "BL Master" },
  { key: "bl_house", label: "BL House" },
  { key: "dias_sin_facturar", label: "Días sin facturar" },
  { key: "venta_usd", label: "Venta USD" },
  { key: "venta_mxn", label: "Venta MXN" },
] as const;

export function buildHuecoCsvFilename(hoy: Date = new Date()): string {
  return `hueco_facturacion_${hoyMx(hoy)}.csv`;
}

export function buildHuecoCsvRows(filas: FilaHueco[]): Record<string, unknown>[] {
  return filas.map((f) => ({
    expediente: f.expediente,
    cliente: f.cliente_nombre,
    operador: f.operador,
    etd: f.etd ? formatDate(f.etd) : "",
    eta: f.eta ? formatDate(f.eta) : "",
    bl_master: f.bl_master ?? "",
    bl_house: f.bl_house ?? "",
    dias_sin_facturar: f.diasDesdeEta,
    venta_usd: f.ventaUsd.toFixed(2),
    venta_mxn: f.ventaMxn.toFixed(2),
  }));
}
