/**
 * Construcción del CSV de "Proyección de Facturación".
 * Lógica pura extraída de `useTabProyeccionController` para mantener el
 * controller dentro del límite de 200 líneas y permitir tests aislados
 * (espejando `huecoCsv.ts`).
 */
import type { GrupoProyeccion } from "@/lib/domain/proyeccionFacturacion";
import { formatDate } from "@/lib/formatters";

export const PROYECCION_CSV_HEADERS = [
  { key: "expediente", label: "Expediente" },
  { key: "cliente", label: "Cliente" },
  { key: "operador", label: "Operador" },
  { key: "eta", label: "ETA" },
  { key: "contenedores", label: "Contenedores" },
  { key: "venta_usd", label: "Venta USD" },
  { key: "venta_mxn", label: "Venta MXN" },
  { key: "costo_usd", label: "Costo USD" },
  { key: "costo_mxn", label: "Costo MXN" },
  { key: "profit_usd", label: "Profit USD" },
  { key: "profit_mxn", label: "Profit MXN" },
  { key: "margen", label: "Margen %" },
  { key: "estado", label: "Estado" },
] as const;

export function buildProyeccionCsvFilename(mesKey: string): string {
  return `proyeccion_${mesKey}.csv`;
}

export function buildProyeccionCsvRows(
  grupos: GrupoProyeccion[],
): Record<string, unknown>[] {
  return grupos.map((g) => ({
    expediente: g.expediente,
    cliente: g.cliente_nombre,
    operador: g.operador,
    eta: g.eta ? formatDate(g.eta) : "",
    contenedores: g.totalContenedores,
    venta_usd: g.ventaUsd.toFixed(2),
    venta_mxn: g.ventaMxn.toFixed(2),
    costo_usd: g.costoUsd.toFixed(2),
    costo_mxn: g.costoMxn.toFixed(2),
    profit_usd: g.profitUsd.toFixed(2),
    profit_mxn: g.profitMxn.toFixed(2),
    margen: g.margenPct.toFixed(1),
    estado: g.estado,
  }));
}
