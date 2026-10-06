import { endOfMonth, format, isValid, parseISO, startOfMonth } from "date-fns";
export type SortField = "profit_usd" | "venta_usd" | "costo_usd" | "margen";

export const MODOS_RENTABILIDAD = ["all", "Marítimo", "Aéreo", "Terrestre", "Multimodal"] as const;
const SORT_FIELDS: SortField[] = ["profit_usd", "venta_usd", "costo_usd", "margen"];
export interface ReportesFilters {
  fechaDesde: Date;
  fechaHasta: Date;
  modo: string;
}
export interface ReportesSelection extends ReportesFilters {
  sortField: SortField;
  sortDir: "asc" | "desc";
}
export const defaultReportesFilters = (now = new Date()): ReportesFilters => ({
  fechaDesde: startOfMonth(now), fechaHasta: endOfMonth(now), modo: "all",
});

function readDate(value: string | null, fallback: Date): Date {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  const date = parseISO(value);
  return isValid(date) && format(date, "yyyy-MM-dd") === value ? date : fallback;
}

/** Never submit malformed dates, inverted ranges or arbitrary modes from links. */
export function readReportesSelection(params: URLSearchParams, defaults: ReportesFilters): ReportesSelection {
  const fechaDesde = readDate(params.get("desde"), defaults.fechaDesde);
  const parsedHasta = readDate(params.get("hasta"), defaults.fechaHasta);
  const modo = params.get("modo") ?? "all";
  const sortField = params.get("sort") as SortField;
  return {
    fechaDesde,
    fechaHasta: parsedHasta < fechaDesde ? endOfMonth(fechaDesde) : parsedHasta,
    modo: MODOS_RENTABILIDAD.some((value) => value === modo) ? modo : "all",
    sortField: SORT_FIELDS.includes(sortField) ? sortField : "profit_usd",
    sortDir: params.get("dir") === "desc" ? "desc" : "asc",
  };
}

/** One URL update commits the entire selection and preserves unrelated params. */
export function writeReportesSelection(params: URLSearchParams, selection: ReportesSelection): URLSearchParams {
  const next = new URLSearchParams(params);
  next.set("desde", format(selection.fechaDesde, "yyyy-MM-dd"));
  next.set("hasta", format(selection.fechaHasta, "yyyy-MM-dd"));
  next.set("modo", selection.modo);
  next.set("sort", selection.sortField);
  next.set("dir", selection.sortDir);
  return next;
}
