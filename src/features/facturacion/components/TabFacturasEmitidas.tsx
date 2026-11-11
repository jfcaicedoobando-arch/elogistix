import { useMemo } from "react";
import { Receipt } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { FILTRO_ANCHO } from "@/lib/ui/filterWidths";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PeriodoFiscalSelector } from "./PeriodoFiscalSelector";
import { FacturasExportMenu } from "./FacturasExportMenu";
import { ResponsiveDataTable } from "@/components/shared/dataTable/ResponsiveDataTable";
import { useRowSelection } from "@/components/shared/dataTable/useRowSelection";
import { buildSelectionColumn } from "@/components/shared/dataTable/buildSelectionColumn";
import { UnifiedFiltersBar } from "@/components/shared/filters/UnifiedFiltersBar";
import { FacturasMasivasToolbar } from "@/features/facturacion/components/FacturasMasivasToolbar";
import { FacturasEmitidasFooter } from "@/features/facturacion/components/FacturasEmitidasFooter";
import { FacturaEmitidaMobileCard } from "@/features/facturacion/components/FacturaEmitidaMobileCard";
import EmptyState from "@/components/empty/EmptyState";
import { usePermissions } from "@/hooks/shared";
import type { Factura } from "@/features/facturacion/routes/facturacionColumns";
import type { ChipItem } from "@/hooks/shared/useTableFilters";
import type { Database } from "@/types/db";
import { rangoLabel } from "@/lib/ui/rangoFechasCopy";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";

type EstadoFactura = Database["public"]["Enums"]["estado_factura"];
const ESTADOS_FACTURA: EstadoFactura[] = [
  "Borrador", "Por timbrar", "Emitida", "Parcialmente pagada", "Pagada", "Vencida", "Cancelada",
];

import type {
  FacturasEmitidasAcciones, FacturasEmitidasFiltros, FacturasEmitidasTabla,
} from "@/features/facturacion/components/facturasEmitidasProps";

interface Props {
  filtros: FacturasEmitidasFiltros;
  tabla: FacturasEmitidasTabla;
  acciones: FacturasEmitidasAcciones;
}

export function TabFacturasEmitidas({ filtros: f, tabla: t, acciones: a }: Props) {
  const { canEmitirFactura } = usePermissions();
  const selection = useRowSelection();
  const columnsConSeleccion = useMemo(
    () => [buildSelectionColumn<Factura>(), ...t.columns],
    [t.columns],
  );

  const chips = useMemo<ChipItem[]>(() => {
    const c: ChipItem[] = [];
    if (f.filterEstado && f.filterEstado !== "todos") {
      c.push({ key: "estado", label: `Estado: ${f.filterEstado}`, onRemove: () => f.setFilter("estado", "todos") });
    }
    if (f.filterCliente && f.filterCliente !== "todos") {
      const cl = f.clientes.find((x) => x.id === f.filterCliente);
      c.push({ key: "cliente", label: `Cliente: ${cl?.nombre ?? f.filterCliente}`, onRemove: () => f.setFilter("cliente", "todos") });
    }
    if (f.fechaDesde) c.push({ key: "desde", label: `Desde: ${f.fechaDesde}`, onRemove: () => f.setFechaDesde("") });
    if (f.fechaHasta) c.push({ key: "hasta", label: `Hasta: ${f.fechaHasta}`, onRemove: () => f.setFechaHasta("") });
    return c;
  }, [f]);
  const primarySlot = (
    <>
      <Select value={f.filterEstado} onValueChange={(v) => f.setFilter("estado", v)}>
        <SelectTrigger className={FILTRO_ANCHO.mdAuto} aria-label="Estado de la factura">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos los estados</SelectItem>
          {ESTADOS_FACTURA.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={f.filterCliente} onValueChange={(v) => f.setFilter("cliente", v)} disabled={f.loadingClientes || f.errorClientes}>
        <SelectTrigger className={FILTRO_ANCHO.lgAuto} aria-label="Cliente">
          <SelectValue placeholder={f.loadingClientes ? "Cargando clientes…" : "Cliente"} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos los clientes</SelectItem>
          {f.clientes.map((c) => (
            <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
  const rangoFecha = (etiqueta: "desde" | "hasta", value: string, onChange: (v: string) => void) => (
    <div className="space-y-1.5">
      <label htmlFor={`facturas-emision-${etiqueta}`} className="text-body-sm font-medium text-muted-foreground">{rangoLabel("Emisión", etiqueta)}</label>
      <DatePickerMx id={`facturas-emision-${etiqueta}`} value={value} onChange={onChange} className="w-full" />
    </div>
  );
  const secondarySlot = (
    <div className="space-y-4">
      {rangoFecha("desde", f.fechaDesde, f.setFechaDesde)}
      {rangoFecha("hasta", f.fechaHasta, f.setFechaHasta)}
    </div>
  );

  return (
    <>
      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-body-sm text-muted-foreground">
            Historial de facturas de todos los estados, incluidos borradores y por timbrar.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-body-sm text-muted-foreground">Período por fecha de emisión · sólo esta bandeja</p>
            <PeriodoFiscalSelector desdeIso={f.fechaDesde || null} hastaIso={f.fechaHasta || null} onChange={f.setPeriodo} />
          </div>
          {f.rangoInvalido && <p role="alert" className="text-body-sm text-destructive">Emisión desde debe ser anterior o igual a Emisión hasta.</p>}
          {f.errorClientes && (
            <div role="alert" className="text-body-sm">
              No se pudo cargar el filtro de clientes. <Button variant="link" size="sm" onClick={f.refetchClientes}>Reintentar clientes</Button>
            </div>
          )}
          <div className="flex flex-wrap gap-3 items-start">
            <div className="flex-1 min-w-[240px]">
              <UnifiedFiltersBar
                search={f.search}
                onSearchChange={f.setSearch}
                searchPlaceholder="Buscar factura o cliente…"
                primary={primarySlot}
                secondary={secondarySlot}
                chips={chips}
                activeCount={chips.length}
                onClearAll={f.onClear}
              />
            </div>
            <FacturasExportMenu acciones={a} />
          </div>
          <div className="text-body-sm text-muted-foreground">
            <strong className="text-foreground">{t.facturasFiltradas.length}</strong> en esta página
            {" · "}{t.totalFacturas} facturas con los filtros aplicados
            <p>CSV y layout contable incluyen todos los resultados filtrados. El ZIP del mes usa el mes elegido al descargar.</p>
          </div>
        </CardContent>
      </Card>

      <FacturasMasivasToolbar
        selectedIds={selection.selectedIds}
        onClear={selection.clear}
        onMarked={selection.remove}
      />

      <Card>
        <CardContent className="p-0">
          <ResponsiveDataTable
            columns={columnsConSeleccion}
            data={t.data}
            isLoading={t.isLoading}
            isError={t.isError}
            onRetry={t.onRetry}
            emptyMessage="No se encontraron facturas"
            emptyState={
              <EmptyState
                icon={Receipt}
                title={f.search || chips.length ? "No se encontraron facturas" : "Aún no hay facturas emitidas"}
                description={f.search || chips.length ? "Ajusta los filtros o busca con otro término." : "Las facturas emitidas desde embarques o proformas aparecerán aquí."}
                primaryAction={!f.search && !chips.length && canEmitirFactura && a.onCreateNew ? { label: "Nueva factura", onClick: a.onCreateNew } : undefined}
              />
            }
            rowKey={(f) => f.id}
            density={TABLE_DENSITY.listado}
            getRowHref={(f) => `/facturacion/${f.id}`}
            rowSelection={selection.rowSelection}
            onRowSelectionChange={selection.onRowSelectionChange}
            pagination={{
              page: t.page,
              totalPages: t.totalPages,
              onPageChange: t.setPage,
              pageSize: t.pageSize,
              onPageSizeChange: (s) => { t.setPageSize(s); t.setPage(0); },
              pageSizeOptions: [50, 100, 200, 500],
              pageSizeLabels: { 500: "500" }, total: t.totalFacturas,
            }}
            mobileCard={(factura) => (
              <div className="flex items-start gap-2">
                <Checkbox className="mt-1 shrink-0" checked={selection.isSelected(factura.id)} onCheckedChange={() => selection.toggle(factura.id)} aria-label={`Seleccionar factura ${factura.numero}`} />
                <div className="min-w-0 flex-1"><FacturaEmitidaMobileCard factura={factura} /></div>
              </div>
            )}
          />
        </CardContent>
      </Card>

      <FacturasEmitidasFooter facturas={t.facturasFiltradas} />

    </>
  );
}
