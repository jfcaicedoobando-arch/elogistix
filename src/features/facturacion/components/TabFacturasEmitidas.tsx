import { useMemo } from "react";
import { Download, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/DataTable";
import { useRowSelection } from "@/components/shared/dataTable/useRowSelection";
import { buildSelectionColumn } from "@/components/shared/dataTable/buildSelectionColumn";
import { FacturasMasivasToolbar } from "@/features/facturacion/components/FacturasMasivasToolbar";
import FacturasFiltros from "@/features/facturacion/components/FacturasFiltros";
import type { ColumnDef } from "@/components/shared/DataTable";
import { FacturasEmitidasFooter } from "@/features/facturacion/components/FacturasEmitidasFooter";
import type { Factura } from "@/features/facturacion/routes/facturacionColumns";

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
}

export function TabFacturasEmitidas(p: Props) {
  const selection = useRowSelection();
  const pageIds = useMemo(() => p.data.map((f) => f.id), [p.data]);
  const columnsConSeleccion = useMemo(
    () => [buildSelectionColumn<Factura>(selection, (f) => f.id, pageIds), ...p.columns],
    [selection, pageIds, p.columns],
  );

  return (
    <>
      <Card>
        <CardContent className="p-4 space-y-0">
          <div className="flex flex-wrap gap-3 items-start">
            <div className="flex-1 min-w-[240px]">
              <FacturasFiltros
                search={p.search}
                onSearchChange={p.setSearch}
                filtroEstado={p.filterEstado}
                onFiltroEstadoChange={(v) => p.setFilter("estado", v)}
                filtroCliente={p.filterCliente}
                onFiltroClienteChange={(v) => p.setFilter("cliente", v)}
                fechaDesde={p.fechaDesde}
                onFechaDesdeChange={p.setFechaDesde}
                fechaHasta={p.fechaHasta}
                onFechaHastaChange={p.setFechaHasta}
                clientes={p.clientes}
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
                <DropdownMenuItem
                  onClick={p.exportarLayoutContable}
                  title="Layout contable con RFC, subtotal, IVA y total — para el contador"
                >
                  Layout contable
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
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
            rowKey={(f) => f.id}
            density="comfortable"
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
