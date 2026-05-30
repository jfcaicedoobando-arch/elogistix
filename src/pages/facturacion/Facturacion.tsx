import { useMemo, useState } from "react";
import { Download, Info } from "lucide-react";
import SearchInput from "@/components/selects/SearchInput";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { DataTable } from "@/components/shared/DataTable";
import { PageHeader } from "@/components/shared/PageHeader";
import type { Database } from "@/types/db";
import { TabProformas } from "@/components/facturacion/TabProformas";
import { TabProformasPendientes } from "@/components/facturacion/TabProformasPendientes";
import { DialogRegistrarPago } from "@/components/facturacion/DialogRegistrarPago";
import { DialogHistorialPagos } from "@/components/facturacion/DialogHistorialPagos";

import { DateRangeFilter } from "@/components/facturacion/DateRangeFilter";
import { GuiaPrefacturacion } from "@/components/facturacion/GuiaPrefacturacion";
import { useFacturacionPageController } from "@/hooks/facturacion";
import { useFacturacionDateRange } from "@/hooks/facturacion";
import { buildFacturaColumns, buildGastoColumns, type Factura } from "./facturacionColumns";

type EstadoFactura = Database["public"]["Enums"]["estado_factura"];
const ESTADOS_FACTURA: EstadoFactura[] = ['Borrador', 'Emitida', 'Parcialmente pagada', 'Pagada', 'Vencida', 'Cancelada'];

type TabDef = { value: string; label: string; hint: string; badge?: number };

function TabTriggerInfo({ tab }: { tab: TabDef }) {
  return (
    <TabsTrigger value={tab.value}>
      <span className="flex items-center gap-1.5">
        {tab.label}
        {typeof tab.badge === "number" && tab.badge > 0 && (
          <span className="ml-0.5">({tab.badge})</span>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              role="button"
              tabIndex={0}
              aria-label={`Info: ${tab.label}`}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              className="inline-flex"
            >
              <Info className="h-3 w-3 opacity-60 hover:opacity-100" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[240px] text-xs">
            {tab.hint}
          </TooltipContent>
        </Tooltip>
      </span>
    </TabsTrigger>
  );
}

export default function Facturacion() {
  const { range, setRango, limpiar, isInRange, activo } = useFacturacionDateRange();

  const {
    search, setSearch,
    filterEstado, setFilter,
    page, setPage, pageSize, setPageSize,
    paginatedFacturas, totalPages,
    gastosPendientes, proformasPendientes,
    loadingFacturas, loadingGastos,
    canEdit, marcarPagadoPending,
    handleMarcarPagado, exportarFacturasCsv, exportarLayoutContable,
  } = useFacturacionPageController({ isInRange });

  const gastoColumns = useMemo(
    () => buildGastoColumns({ canEdit, marcarPagadoPending, handleMarcarPagado }),
    [canEdit, marcarPagadoPending, handleMarcarPagado],
  );

  const tabs: TabDef[] = [
    { value: "pendientes", label: "1. Por aprobar", hint: "Proformas generadas pendientes de revisión. Consolida y aprueba aquí.", badge: proformasPendientes.length },
    { value: "proformas", label: "2. Proformas", hint: "Histórico completo de proformas (pendientes y facturadas)." },
    { value: "facturas", label: "3. Facturas emitidas", hint: "Facturas ya generadas. Export CSV y layout contable para el contador." },
    { value: "liquidacion", label: "4. Pagos a proveedores", hint: "Costos de proveedores pendientes de pago (cuentas por pagar)." },
  ];

  const dateBar = (
    <Card>
      <CardContent className="p-3">
        <DateRangeFilter range={range} onChange={setRango} onClear={limpiar} activo={activo} />
      </CardContent>
    </Card>
  );

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-6">
        <PageHeader
          title="Pre-Facturación"
          description="Control de proformas, facturas emitidas y gastos por liquidar"
        />

        <GuiaPrefacturacion />

        <Tabs defaultValue="pendientes">
          <TabsList>
            {tabs.map((t) => <TabTriggerInfo key={t.value} tab={t} />)}
          </TabsList>


          <TabsContent value="pendientes" className="space-y-4">
            {dateBar}
            <TabProformasPendientes isInRange={isInRange} />
          </TabsContent>

          <TabsContent value="proformas" className="space-y-4">
            {dateBar}
            <TabProformas isInRange={isInRange} />
          </TabsContent>

          <TabsContent value="facturas" className="space-y-4">
            {dateBar}
            <Card>
              <CardContent className="p-4 flex flex-wrap gap-3">
                <SearchInput value={search} onChange={setSearch} placeholder="Buscar factura o cliente..." className="flex-1 min-w-[200px]" />
                <Button variant="outline" onClick={exportarFacturasCsv}>
                  <Download className="h-4 w-4 mr-2" /> Exportar CSV
                </Button>
                <Button variant="outline" onClick={exportarLayoutContable} title="Layout contable con RFC, subtotal, IVA y total — para el contador">
                  <Download className="h-4 w-4 mr-2" /> Layout contable
                </Button>
                <Select value={filterEstado} onValueChange={(v) => setFilter("estado", v)}>
                  <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {ESTADOS_FACTURA.map(estadoFactura => <SelectItem key={estadoFactura} value={estadoFactura}>{estadoFactura}</SelectItem>)}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-0">
                <DataTable
                  columns={facturaColumns}
                  data={paginatedFacturas}
                  isLoading={loadingFacturas}
                  emptyMessage="No se encontraron facturas"
                  rowKey={(f) => f.id}
                  density="comfortable"
                  pagination={{
                    page,
                    totalPages,
                    onPageChange: setPage,
                    pageSize,
                    onPageSizeChange: (s) => { setPageSize(s); setPage(0); },
                    pageSizeOptions: [100, 999999],
                    pageSizeLabels: { 999999: "Todos" },
                  }}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="liquidacion" className="space-y-4">
            {dateBar}
            <Card>
              <CardContent className="p-0">
                <DataTable
                  columns={gastoColumns}
                  data={gastosPendientes}
                  isLoading={loadingGastos}
                  emptyMessage="No hay gastos pendientes"
                  rowKey={(g) => g.id}
                  density="comfortable"
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}
