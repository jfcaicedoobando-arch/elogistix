import { useMemo } from "react";
import { useMemo } from "react";
import { Download, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import SearchInput from "@/components/shared/SearchInput";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/shared/DataTable";
import { useRowSelection } from "@/components/shared/dataTable/useRowSelection";
import { buildSelectionColumn } from "@/components/shared/dataTable/buildSelectionColumn";
import { FacturasMasivasToolbar } from "@/features/facturacion/components/FacturasMasivasToolbar";
import type { Database } from "@/types/db";
import type { ColumnDef } from "@/components/shared/DataTable";
import type { Factura } from "@/features/facturacion/routes/facturacionColumns";

type EstadoFactura = Database["public"]["Enums"]["estado_factura"];
const ESTADOS_FACTURA: EstadoFactura[] = ['Borrador', 'Por timbrar', 'Emitida', 'Parcialmente pagada', 'Pagada', 'Vencida', 'Cancelada'];

interface Props {
  search: string;
  setSearch: (v: string) => void;
  filterEstado: string;
  setFilter: <K extends "estado">(k: K, v: string) => void;
  exportarFacturasCsv: () => void;
  exportarLayoutContable: () => void;
  columns: ColumnDef<Factura, unknown>[];
  data: Factura[];
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
        <CardContent className="p-4 flex flex-wrap gap-3">
          <SearchInput value={p.search} onChange={p.setSearch} placeholder="Buscar factura o cliente..." className="flex-1 min-w-[200px]" />
          <Button variant="outline" onClick={p.exportarFacturasCsv}>
            <Download className="h-4 w-4 mr-2" /> Exportar CSV
          </Button>
          <Button variant="outline" onClick={p.exportarLayoutContable} title="Layout contable con RFC, subtotal, IVA y total — para el contador">
            <Download className="h-4 w-4 mr-2" /> Layout contable
          </Button>
          <Select value={p.filterEstado} onValueChange={(v) => p.setFilter("estado", v)}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {ESTADOS_FACTURA.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
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
    </>
  );
}
