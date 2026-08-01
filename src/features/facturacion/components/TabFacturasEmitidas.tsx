import { useMemo } from "react";

import { Download, ChevronDown } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/DataTable";
import { useRowSelection } from "@/components/shared/dataTable/useRowSelection";
import { buildSelectionColumn } from "@/components/shared/dataTable/buildSelectionColumn";
import { UnifiedFiltersBar } from "@/components/shared/filters/UnifiedFiltersBar";
import { FacturasMasivasToolbar } from "@/features/facturacion/components/FacturasMasivasToolbar";
import { FacturasEmitidasFooter } from "@/features/facturacion/components/FacturasEmitidasFooter";
import EmptyState from "@/components/empty/EmptyState";
import { Receipt } from "lucide-react";
import { usePermissions } from "@/hooks/shared";
import type { ColumnDef } from "@/components/shared/DataTable";
import type { Factura } from "@/features/facturacion/routes/facturacionColumns";
import type { ChipItem } from "@/hooks/shared/useTableFilters";
import type { Database } from "@/types/db";
import { rangoLabel } from "@/lib/ui/rangoFechasCopy";

type EstadoFactura = Database["public"]["Enums"]["estado_factura"];
const ESTADOS_FACTURA: EstadoFactura[] = [
  "Borrador", "Por timbrar", "Emitida", "Parcialmente pagada", "Pagada", "Vencida", "Cancelada",
];

interface ClienteOption { id: string; nombre: string }

interface Props {
  search: string;
  setSearch: (v: string) => void;
  filterEstado: string;
  filterCliente: string;
  setFilter: <K extends "estado" | "cliente">(k: K, v: string) => void;
  fechaDesde: string;
  setFechaDesde: (v: string) => void;
  fechaHasta: string;
  setFechaHasta: (v: string) => void;
  clientes: ClienteOption[];
  onClearFiltros: () => void;
  exportarFacturasCsv: () => void;
  exportarLayoutContable: () => void;
  columns: ColumnDef<Factura, unknown>[];
  data: Factura[];
  facturasFiltradas: Factura[];
  totalFacturas: number;
  isLoading: boolean;
  page: number;
  totalPages: number;
  setPage: (n: number) => void;
  pageSize: number;
  setPageSize: (n: number) => void;
  onCreateNew?: () => void;
}

export function TabFacturasEmitidas(p: Props) {
  const { canEmitirFactura } = usePermissions();
  const selection = useRowSelection();
  const columnsConSeleccion = useMemo(
    () => [buildSelectionColumn<Factura>(), ...p.columns],
    [p.columns],
  );

  const chips = useMemo<ChipItem[]>(() => {
    const c: ChipItem[] = [];
    if (p.filterEstado && p.filterEstado !== "todos") {
      c.push({ key: "estado", label: `Estado: ${p.filterEstado}`, onRemove: () => p.setFilter("estado", "todos") });
    }
    if (p.filterCliente && p.filterCliente !== "todos") {
      const cl = p.clientes.find((x) => x.id === p.filterCliente);
      c.push({ key: "cliente", label: `Cliente: ${cl?.nombre ?? p.filterCliente}`, onRemove: () => p.setFilter("cliente", "todos") });
    }
    if (p.fechaDesde) c.push({ key: "desde", label: `Desde: ${p.fechaDesde}`, onRemove: () => p.setFechaDesde("") });
    if (p.fechaHasta) c.push({ key: "hasta", label: `Hasta: ${p.fechaHasta}`, onRemove: () => p.setFechaHasta("") });
    return c;
  }, [p]);

  const primarySlot = (
    <>
      <Select value={p.filterEstado} onValueChange={(v) => p.setFilter("estado", v)}>
        <SelectTrigger className="w-[180px]" aria-label="Estado de la factura">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos los estados</SelectItem>
          {ESTADOS_FACTURA.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={p.filterCliente} onValueChange={(v) => p.setFilter("cliente", v)}>
        <SelectTrigger className="w-[210px]" aria-label="Cliente">
          <SelectValue placeholder="Cliente" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos los clientes</SelectItem>
          {p.clientes.map((c) => (
            <SelectItem key={c.id} value={c.id}>{c.nombre.split(" ").slice(0, 3).join(" ")}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );

  const secondarySlot = (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">{rangoLabel("Emisión", "desde")}</label>
        <DatePickerMx value={p.fechaDesde} onChange={p.setFechaDesde} className="w-full" />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">{rangoLabel("Emisión", "hasta")}</label>
        <DatePickerMx value={p.fechaHasta} onChange={p.setFechaHasta} className="w-full" />
      </div>
    </div>
  );

  return (
    <>
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-3 items-start">
            <div className="flex-1 min-w-[240px]">
              <UnifiedFiltersBar
                search={p.search}
                onSearchChange={p.setSearch}
                searchPlaceholder="Buscar factura o cliente..."
                primary={primarySlot}
                secondary={secondarySlot}
                chips={chips}
                activeCount={chips.length}
                onClearAll={p.onClearFiltros}
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
                <DropdownMenuItem onClick={p.exportarFacturasCsv}>CSV de facturas</DropdownMenuItem>
                <DropdownMenuItem onClick={p.exportarLayoutContable} title="Layout contable con RFC, subtotal, IVA y total">
                  Layout contable
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="text-xs text-muted-foreground">
            Mostrando <strong className="text-foreground">{p.facturasFiltradas.length}</strong> de {p.totalFacturas} facturas
          </div>
        </CardContent>
      </Card>

      <FacturasMasivasToolbar selectedIds={selection.selectedIds} onClear={selection.clear} />

      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columnsConSeleccion}
            data={p.data}
            isLoading={p.isLoading}
            emptyMessage="No se encontraron facturas"
            emptyState={
              <EmptyState
                icon={Receipt}
                title={p.search ? "No se encontraron facturas" : "Aún no hay facturas emitidas"}
                description={p.search ? "Ajusta los filtros o busca con otro término." : "Las facturas emitidas desde embarques o proformas aparecerán aquí."}
                primaryAction={!p.search && canEmitirFactura && p.onCreateNew ? { label: "Crear factura", onClick: p.onCreateNew } : undefined}
              />
            }
            rowKey={(f) => f.id}
            density="comfortable"
            getRowHref={(f) => `/facturacion/${f.id}`}
            rowSelection={selection.rowSelection}
            onRowSelectionChange={selection.onRowSelectionChange}
            pagination={{
              page: p.page,
              totalPages: p.totalPages,
              onPageChange: p.setPage,
              pageSize: p.pageSize,
              onPageSizeChange: (s) => { p.setPageSize(s); p.setPage(0); },
              pageSizeOptions: [50, 100, 200, 500],
              pageSizeLabels: { 500: "500" },
            }}
          />
        </CardContent>
      </Card>

      <FacturasEmitidasFooter facturas={p.facturasFiltradas} />
    </>
  );
}
