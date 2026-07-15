import { formatCurrency } from "@/lib/formatters";
import type { EstadoResultados, ModoColumna } from "@/features/profit/domain/estadoResultados";

export function fmt(n: number): string {
  if (n === 0) return "—";
  return formatCurrency(n, "MXN");
}

export function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}

export const ESTADO_RESULTADOS_CSV_HEADERS = [
  { key: "seccion", label: "Sección" },
  { key: "concepto", label: "Concepto" },
  { key: "maritimo", label: "Marítimo" },
  { key: "aereo", label: "Aéreo" },
  { key: "terrestre", label: "Terrestre" },
  { key: "otros", label: "Otros" },
  { key: "total", label: "Total" },
] as const;

export function buildEstadoResultadosCsvRows(data: EstadoResultados) {
  const rowOf = (
    seccion: string,
    concepto: string,
    f: { porModo: Record<ModoColumna, number>; total: number },
  ) => ({
    seccion,
    concepto,
    maritimo: f.porModo["Marítimo"].toFixed(2),
    aereo: f.porModo["Aéreo"].toFixed(2),
    terrestre: f.porModo["Terrestre"].toFixed(2),
    otros: f.porModo["Otros"].toFixed(2),
    total: f.total.toFixed(2),
  });
  const rows: Record<string, unknown>[] = [];
  for (const r of data.ingresos) rows.push(rowOf("Ingresos", r.concepto, r));
  rows.push(rowOf("Ingresos", "TOTAL INGRESOS", data.totalIngresos));
  for (const r of data.costos) rows.push(rowOf("Costos", r.concepto, r));
  rows.push(rowOf("Costos", "TOTAL COSTOS", data.totalCostos));
  rows.push(rowOf("Resultado", "UTILIDAD BRUTA", data.utilidad));
  rows.push({
    seccion: "Resultado",
    concepto: "MARGEN %",
    maritimo: data.margen.porModo["Marítimo"].toFixed(2),
    aereo: data.margen.porModo["Aéreo"].toFixed(2),
    terrestre: data.margen.porModo["Terrestre"].toFixed(2),
    otros: data.margen.porModo["Otros"].toFixed(2),
    total: data.margen.total.toFixed(2),
  });
  return rows;
}
