/**
 * CxP Por Pagar — facturas de proveedor vigentes con saldo.
 *
 * v13.173.0 (Ola 1 · Filtros globales) — migrada a `useClientPagedList` +
 * `<UnifiedFiltersBar />` con search, filtro de moneda, filtro de vencidas,
 * rango de fecha de vencimiento, orden y paginación sincronizados con la URL.
 */
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Inbox, CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProgramarPagoDialog } from "./_sections/ProgramarPagoDialog";
import { useCxpPorPagar } from "@/features/bandejas/hooks/useBandejas";
import { resumirCxpPorPagar } from "@/features/bandejas/domain/aggregates";
import { CxpPorPagarKpis } from "./_sections/CxpPorPagarKpis";

import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { CargaGuard } from "@/components/shared/states/CargaGuard";
import { DataTable } from "@/components/shared/DataTable";
import { useClientPagedList } from "@/hooks/shared/useClientPagedList";
import { buildCxpPorPagarColumns, type CxpRow } from "./_sections/cxpPorPagarColumns";
import { useProgramarPagoLote } from "@/features/cxp/hooks/useProgramarPagoLote";
import { todayLocalISO } from "@/lib/date/today";
import { CxpPorPagarFiltersBar } from "@/features/bandejas/components/CxpPorPagarFiltersBar";


interface Filters extends Record<string, string> {
  moneda: string;
  vencidas: string;
}
const DEFAULTS: Filters = { moneda: "todas", vencidas: "todas" };

export default function CxpPorPagar() {
  const { data = [], isLoading, isError, refetch } = useCxpPorPagar();
  const { saldoMXN, porMoneda, faltaTipoCambio, vencidas } = resumirCxpPorPagar(data);
  const [rowSelection, setRowSelection] = useState({});
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [fechaProgramada, setFechaProgramada] = useState(todayLocalISO());
  const { programar, isRunning, progreso } = useProgramarPagoLote();

  const monedas = useMemo(
    () => Array.from(new Set(data.map((r) => r.moneda).filter(Boolean))).sort(),
    [data],
  );

  const paged = useClientPagedList<CxpRow, Filters>({
    data,
    isLoading,
    defaultFilters: DEFAULTS,
    filterLabels: { moneda: "Moneda", vencidas: "Vencidas" },
    defaultSort: { key: "dias", dir: "asc" },
    searchAccessor: (r) =>
      `${r.proveedor_nombre ?? ""} ${r.folio_proveedor ?? ""} ${r.expediente ?? ""}`,
    filterPredicate: (r, ff) => {
      if (ff.moneda !== "todas" && r.moneda !== ff.moneda) return false;
      const dias = r.dias_para_vencer ?? 0;
      if (ff.vencidas === "si" && dias >= 0) return false;
      if (ff.vencidas === "no" && dias < 0) return false;
      return true;
    },
    dateAccessor: (r) => r.fecha_vencimiento,
    sorters: {
      proveedor: (a, b) => (a.proveedor_nombre ?? "").localeCompare(b.proveedor_nombre ?? ""),
      folio: (a, b) => (a.folio_proveedor ?? "").localeCompare(b.folio_proveedor ?? ""),
      vencimiento: (a, b) => (a.fecha_vencimiento ?? "").localeCompare(b.fecha_vencimiento ?? ""),
      dias: (a, b) => (a.dias_para_vencer ?? 0) - (b.dias_para_vencer ?? 0),
      total: (a, b) => Number(a.total) - Number(b.total),
      pagado: (a, b) => Number(a.pagado) - Number(b.pagado),
      saldo: (a, b) => Number(a.saldo) - Number(b.saldo),
    },
  });

  const columns = useMemo(() => buildCxpPorPagarColumns(), []);

  const selectedIds = useMemo(() => Object.keys(rowSelection), [rowSelection]);
  const hasSelection = selectedIds.length > 0;

  const handleProgramar = async () => {
    await programar(selectedIds, fechaProgramada);
    setIsDialogOpen(false);
    setRowSelection({});
  };

  return (
    <PageContainer>
      <PageHeader
        title="CxP — Por pagar"
        description="Facturas de proveedor vigentes con saldo. Programa y registra los pagos."
        actions={
          hasSelection && (
            <Button onClick={() => setIsDialogOpen(true)} variant="default">
              <CalendarCheck className="h-4 w-4 mr-2" />
              Programar pago ({selectedIds.length})
            </Button>
          )
        }
      />



      <CargaGuard
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        errorTitle="No se pudo cargar la bandeja de pagos"
        errorDescription="Revisa tu conexión y vuelve a intentar."
      >
      <CxpPorPagarKpis
        totalFacturas={data.length}
        resumen={{ saldoMXN, porMoneda, faltaTipoCambio, vencidas }}
      />

      <CxpPorPagarFiltersBar
        search={paged.search}
        onSearchChange={paged.setSearch}
        vencidas={paged.filters.vencidas}
        onVencidasChange={(v) => paged.setFilter("vencidas", v)}
        moneda={paged.filters.moneda}
        onMonedaChange={(v) => paged.setFilter("moneda", v)}
        monedas={monedas}
        dateFrom={paged.dateFrom}
        onDateFromChange={paged.setDateFrom}
        dateTo={paged.dateTo}
        onDateToChange={paged.setDateTo}
        chips={paged.activeChips}
        activeCount={paged.activeCount}
        onClearAll={paged.resetAll}
      />

      <Card>
        <CardContent className="p-0">
          <DataTable<CxpRow>
            columns={columns}
            data={paged.rows}
            rowKey={(r) => r.factura_id}
            isLoading={paged.isLoading}
            sortMode="server"
            controlledSort={paged.controlledSort}
            onSortChange={paged.setSort}
            pagination={paged.pagination}
            getRowHref={(r) => `/cxp?factura=${r.factura_id}`}
            getRowAriaLabel={(r) => `Factura ${r.folio_proveedor ?? ""} de ${r.proveedor_nombre ?? ""}`}
            emptyIcon={Inbox}
            emptyMessage="Sin facturas pendientes de pago"
            emptyHint="Cuando ingreses una factura de proveedor, aparecerá aquí."
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            enableRowSelection
          />
        </CardContent>
      </Card>

      <ProgramarPagoDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        cantidad={selectedIds.length}
        fechaProgramada={fechaProgramada}
        onFechaChange={setFechaProgramada}
        isRunning={isRunning}
        progreso={progreso}
        onConfirmar={handleProgramar}
      />
      </CargaGuard>
    </PageContainer>
  );
}
