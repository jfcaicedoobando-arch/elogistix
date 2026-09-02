/**
 * CxP Por Pagar — facturas de proveedor vigentes con saldo.
 *
 * v13.173.0 (Ola 1 · Filtros globales) — migrada a `useClientPagedList` +
 * `<UnifiedFiltersBar />` con search, filtro de moneda, filtro de vencidas,
 * rango de fecha de vencimiento, orden y paginación sincronizados con la URL.
 */
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Inbox, CalendarCheck, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogPagoLoteProveedor } from "@/features/cxp";

import { ProgramarPagoDialog } from "./_sections/ProgramarPagoDialog";
import { useCxpPorPagar } from "@/features/bandejas/hooks/useBandejas";
import { resumirCxpPorPagar } from "@/features/bandejas/domain/aggregates";
import { CxpPorPagarKpis } from "./_sections/CxpPorPagarKpis";

import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { CargaGuard } from "@/components/shared/states/CargaGuard";
import { ResponsiveDataTable } from "@/components/shared/dataTable/ResponsiveDataTable";
import { useClientPagedList } from "@/hooks/shared/useClientPagedList";
import { buildCxpPorPagarColumns, type CxpRow } from "./_sections/cxpPorPagarColumns";
import { useProgramarPagoLote } from "@/features/cxp/hooks";
import { todayLocalISO } from "@/lib/date/today";
import { CxpPorPagarFiltersBar } from "@/features/bandejas/components/CxpPorPagarFiltersBar";
import { CxpPorPagarMobileCard } from "@/features/bandejas/components/CxpPorPagarMobileCard";
import { usePermissions } from "@/hooks/shared/usePermissions";
import {
  CXP_FILTERS_DEFAULTS,
  CXP_SORTERS,
  cxpFilterPredicate,
  cxpSearchAccessor,
  derivarLote,
  type CxpFilters,
} from "./_sections/cxpPorPagarList";

export default function CxpPorPagar() {
  const { data = [], isLoading, isError, refetch } = useCxpPorPagar();
  const { saldoMXN, porMoneda, faltaTipoCambio, vencidas } = resumirCxpPorPagar(data);
  const [rowSelection, setRowSelection] = useState({});
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loteOpen, setLoteOpen] = useState(false);

  const [fechaProgramada, setFechaProgramada] = useState(todayLocalISO());
  const { programar, isRunning, progreso } = useProgramarPagoLote();
  // RFE-04 (Ola 11): /compras/por-pagar admite gerentes de sólo lectura;
  // `registrar_pago_proveedor_lote` rechaza con 42501 (LC_LOTE_SIN_ROL) a
  // quien no está en PAGAR_PROVEEDOR. Mismo gate que el pago individual.
  const { canPagarProveedor } = usePermissions();

  const monedas = useMemo(
    () => Array.from(new Set(data.map((r) => r.moneda).filter(Boolean))).sort(),
    [data],
  );

  const paged = useClientPagedList<CxpRow, CxpFilters>({
    data,
    isLoading,
    defaultFilters: CXP_FILTERS_DEFAULTS,
    filterLabels: { moneda: "Moneda", vencidas: "Vencidas" },
    defaultSort: { key: "dias", dir: "asc" },
    searchAccessor: cxpSearchAccessor,
    filterPredicate: cxpFilterPredicate,
    dateAccessor: (r) => r.fecha_vencimiento,
    sorters: CXP_SORTERS,
  });

  const columns = useMemo(() => buildCxpPorPagarColumns(), []);

  const selectedIds = useMemo(() => Object.keys(rowSelection), [rowSelection]);
  const hasSelection = selectedIds.length > 0;

  // Pago en lote: sólo si la selección es del mismo proveedor y la misma moneda.
  const seleccionadas = useMemo(
    () => data.filter((r) => selectedIds.includes(r.factura_id)),
    [data, selectedIds],
  );
  const lote = useMemo(() => derivarLote(seleccionadas), [seleccionadas]);

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
          canPagarProveedor && hasSelection && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setIsDialogOpen(true)} variant="outline">
                <CalendarCheck className="h-4 w-4 mr-2" />
                Programar pago ({selectedIds.length})
              </Button>
              <Button
                onClick={() => setLoteOpen(true)}
                disabled={!lote}
                title={
                  lote
                    ? undefined
                    : "Selecciona 2 o más facturas del mismo proveedor y la misma moneda"
                }
              >
                <Layers className="h-4 w-4 mr-2" />
                Pagar en lote ({selectedIds.length})
              </Button>
            </div>
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
        dateFrom={paged.dateFrom ?? ""}
        onDateFromChange={paged.setDateFrom}
        dateTo={paged.dateTo ?? ""}
        onDateToChange={paged.setDateTo}

        chips={paged.activeChips}
        activeCount={paged.activeCount}
        onClearAll={paged.resetAll}
      />

      <Card>
        <CardContent className="p-0">
          <ResponsiveDataTable<CxpRow>
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
            rowSelection={canPagarProveedor ? rowSelection : undefined}
            onRowSelectionChange={canPagarProveedor ? setRowSelection : undefined}
            enableRowSelection={canPagarProveedor}
            mobileCard={(r) => <CxpPorPagarMobileCard row={r} />}
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

      {lote && (
        <DialogPagoLoteProveedor
          open={loteOpen}
          onOpenChange={setLoteOpen}
          proveedorId={lote.proveedorId}
          proveedorNombre={lote.proveedorNombre}
          proveedorOrigen={lote.proveedorOrigen}
          moneda={lote.moneda}
          facturas={lote.facturas}
          onDone={() => setRowSelection({})}
        />
      )}
      </CargaGuard>

    </PageContainer>
  );
}
