import { formatDateOnlyLocal } from "@/lib/date/dateOnly";
import { useReportesFilters } from "@/features/reportes/hooks/useReportesFilters";
import ReportesFiltros from "@/features/reportes/components/ReportesFiltros";
import ReportesTablaClientes from "@/features/reportes/components/ReportesTablaClientes";

export function ReportFixture() {
  const c = useReportesFilters();
  const desde = formatDateOnlyLocal(c.fechaDesde);
  const hasta = formatDateOnlyLocal(c.fechaHasta);
  // Deliberately synthetic rows; this fixture tests navigation/filter lifecycle,
  // never financial arithmetic, application data or a backend query.
  const inRange = desde <= "2026-10-05" && hasta >= "2026-10-05";
  const rows = inRange ? [{ cliente_id: "synthetic", cliente_nombre: "Cliente Sintético", total_embarques: 2, venta_usd: 10, costo_usd: 8, profit_usd: 2, margen: 20 }] : [];
  return <main className="p-4 space-y-4">
    <h1>Rentabilidad aislada 136 y 137</h1>
    <output data-testid="applied">{desde}|{hasta}|{c.modo}|{c.sortField}|{c.sortDir}</output>
    <output data-testid="dataset">Filas sintéticas: {rows.length}</output>
    <ReportesFiltros fechaDesde={c.fechaDesde} fechaHasta={c.fechaHasta} modo={c.modo} onFechaDesdeChange={c.setFechaDesde} onFechaHastaChange={c.setFechaHasta} onModoChange={c.setModo} onApplyFilters={c.applyFilters} />
    <ReportesTablaClientes data={rows} isLoading={false} sortField={c.sortField} sortDir={c.sortDir} onSort={c.handleSort} />
  </main>;
}
