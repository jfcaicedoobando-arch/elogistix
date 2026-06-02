import { useMemo, useState } from "react";
import { Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { DataTable } from "@/components/shared/DataTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { TabProformas } from "@/components/facturacion/TabProformas";
import { TabProformasPendientes } from "@/components/facturacion/TabProformasPendientes";
import { TabFacturasEmitidas } from "@/components/facturacion/TabFacturasEmitidas";
import { TabCobranza } from "@/components/facturacion/TabCobranza";
import { DialogRegistrarPago } from "@/components/facturacion/DialogRegistrarPago";
import { DialogHistorialPagos } from "@/components/facturacion/DialogHistorialPagos";
import { DateRangeFilter } from "@/components/facturacion/DateRangeFilter";
import { GuiaPrefacturacion } from "@/components/facturacion/GuiaPrefacturacion";
import { useFacturacionPageController, useFacturacionDateRange } from "@/hooks/facturacion";
import { buildFacturaColumns, buildGastoColumns, type Factura } from "./facturacionColumns";

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
            <span role="button" tabIndex={0} aria-label={`Info: ${tab.label}`}
              onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}
              className="inline-flex">
              <Info className="h-3 w-3 opacity-60 hover:opacity-100" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[240px] text-xs">{tab.hint}</TooltipContent>
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

  const [pagoFactura, setPagoFactura] = useState<Factura | null>(null);
  const [historialFactura, setHistorialFactura] = useState<Factura | null>(null);

  const facturaColumns = useMemo(
    () => buildFacturaColumns({
      canEdit, onRegistrarPago: setPagoFactura, onVerPagos: setHistorialFactura,
    }),
    [canEdit],
  );

  const gastoColumns = useMemo(
    () => buildGastoColumns({ canEdit, marcarPagadoPending, handleMarcarPagado }),
    [canEdit, marcarPagadoPending, handleMarcarPagado],
  );

  const tabs: TabDef[] = [
    { value: "pendientes", label: "1. Por aprobar", hint: "Proformas generadas pendientes de revisión. Consolida y aprueba aquí.", badge: proformasPendientes.length },
    { value: "proformas", label: "2. Proformas", hint: "Histórico completo de proformas (pendientes y facturadas)." },
    { value: "facturas", label: "3. Facturas emitidas", hint: "Facturas ya generadas. Export CSV y layout contable para el contador." },
    { value: "cobranza", label: "4. Cobranza", hint: "Cartera por cobrar: saldos, vencimientos, pagos y notas de crédito." },
    { value: "liquidacion", label: "5. Pagos a proveedores", hint: "Costos de proveedores pendientes de pago (cuentas por pagar)." },
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
        <PageHeader title="Pre-Facturación" description="Control de proformas, facturas emitidas y gastos por liquidar" />
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
            <TabFacturasEmitidas
              search={search} setSearch={setSearch}
              filterEstado={filterEstado} setFilter={setFilter}
              exportarFacturasCsv={exportarFacturasCsv}
              exportarLayoutContable={exportarLayoutContable}
              columns={facturaColumns}
              data={paginatedFacturas}
              isLoading={loadingFacturas}
              page={page} totalPages={totalPages} setPage={setPage}
              pageSize={pageSize} setPageSize={setPageSize}
            />
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

        <DialogRegistrarPago
          open={!!pagoFactura}
          onOpenChange={(o) => !o && setPagoFactura(null)}
          factura={pagoFactura}
        />
        <DialogHistorialPagos
          open={!!historialFactura}
          onOpenChange={(o) => !o && setHistorialFactura(null)}
          factura={historialFactura}
          canEdit={canEdit}
        />
      </div>
    </TooltipProvider>
  );
}
