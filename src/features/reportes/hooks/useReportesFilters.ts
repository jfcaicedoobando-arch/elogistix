import { useMemo } from "react";
import { endOfMonth, startOfMonth } from "date-fns";
import { useSearchParams } from "react-router";
import { notifyWarning } from "@/lib/ui/appFeedback";
import type { SortField } from "../domain/reportesFilters";
import { defaultReportesFilters, readReportesSelection, writeReportesSelection, type ReportesFilters, type ReportesSelection } from "../domain/reportesFilters";

export function useReportesFilters() {
  const [params, setParams] = useSearchParams();
  const defaults = useMemo(() => defaultReportesFilters(), []);
  const selection = useMemo(() => readReportesSelection(params, defaults), [params, defaults]);
  const update = (next: ReportesSelection) => setParams(writeReportesSelection(params, next), { replace: true });
  const applyFilters = (filters: ReportesFilters) => update({ ...selection, ...filters });
  const warn = () => notifyWarning(undefined, {
    title: "Rango de fechas ajustado",
    description: "La fecha «Desde» no puede ser posterior a «Hasta».",
    id: "reportes-rango-fechas-invertido",
  });
  const setFechaDesde = (date: Date) => {
    const inverted = date > selection.fechaHasta;
    applyFilters({ ...selection, fechaDesde: date, fechaHasta: inverted ? endOfMonth(date) : selection.fechaHasta });
    if (inverted) warn();
  };
  const setFechaHasta = (date: Date) => {
    const inverted = date < selection.fechaDesde;
    applyFilters({ ...selection, fechaHasta: date, fechaDesde: inverted ? startOfMonth(date) : selection.fechaDesde });
    if (inverted) warn();
  };
  const handleSort = (field: SortField) => update({
    ...selection,
    sortField: field,
    sortDir: selection.sortField === field && selection.sortDir === "desc" ? "asc" : "desc",
  });
  return {
    ...selection, setFechaDesde, setFechaHasta, applyFilters, handleSort,
    setModo: (modo: string) => applyFilters({ ...selection, modo }),
    resetFilters: () => applyFilters(defaultReportesFilters()),
  };
}
