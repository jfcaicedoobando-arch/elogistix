import { useMemo, useState } from "react";
import { Download, ChevronDown, Receipt } from "lucide-react";
import { DialogDescargarZipMes } from "@/features/facturacion/components/DialogDescargarZipMes";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { FILTRO_ANCHO } from "@/lib/ui/filterWidths";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/DataTable";
import { useRowSelection } from "@/components/shared/dataTable/useRowSelection";
import { buildSelectionColumn } from "@/components/shared/dataTable/buildSelectionColumn";
import { UnifiedFiltersBar } from "@/components/shared/filters/UnifiedFiltersBar";
import { FacturasMasivasToolbar } from "@/features/facturacion/components/FacturasMasivasToolbar";
import { FacturasEmitidasFooter } from "@/features/facturacion/components/FacturasEmitidasFooter";
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
  const [zipMesOpen, setZipMesOpen] = useState(false);
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
      <Select value={f.filterCliente} onValueChange={(v) => f.setFilter("cliente", v)}>
        <SelectTrigger className={FILTRO_ANCHO.lgAuto} aria-label="Cliente">
          <SelectValue placeholder="Cliente" />
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
      <label className="text-body-sm font-medium text-muted-foreground">{rangoLabel("Emisión", etiqueta)}</label>
      <DatePickerMx value={value} onChange={onChange} className="w-full" />
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="shrink-0 gap-2">
                  <Download className="h-4 w-4" />
                  <span>Exportar</span>
                  <ChevronDown className="h-4 w-4 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={a.exportarFacturasCsv}>CSV de facturas</DropdownMenuItem>
                <DropdownMenuItem onClick={a.exportarLayoutContable} title="Layout contable con RFC, subtotal, IVA y total">
                  Layout contable
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setZipMesOpen(true)} title="Paquete PDF+XML de todos los CFDI del mes, generado por el PAC">
                  ZIP del mes (PAC)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="text-body-sm text-muted-foreground">
            Mostrando <strong className="text-foreground">{t.facturasFiltradas.length}</strong> de {t.totalFacturas} facturas
          </div>
        </CardContent>
      </Card>

      <FacturasMasivasToolbar selectedIds={selection.selectedIds} onClear={selection.clear} />

      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columnsConSeleccion}
            data={t.data}
            isLoading={t.isLoading}
            isError={t.isError}
            onRetry={t.onRetry}
            emptyMessage="No se encontraron facturas"
            emptyState={
              <EmptyState
                icon={Receipt}
                title={f.search ? "No se encontraron facturas" : "Aún no hay facturas emitidas"}
                description={f.search ? "Ajusta los filtros o busca con otro término." : "Las facturas emitidas desde embarques o proformas aparecerán aquí."}
                primaryAction={!f.search && canEmitirFactura && a.onCreateNew ? { label: "Nueva factura", onClick: a.onCreateNew } : undefined}
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
          />
        </CardContent>
      </Card>

      <FacturasEmitidasFooter facturas={t.facturasFiltradas} />

      <DialogDescargarZipMes open={zipMesOpen} onOpenChange={setZipMesOpen} />
    </>
  );
}
