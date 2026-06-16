import { Download } from "lucide-react";
import SearchInput from "@/components/selects/SearchInput";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/shared/DataTable";
import type { Database } from "@/types/db";
import type { ColumnDef } from "@/components/shared/DataTable";
import type { Factura } from "@/pages/facturacion/facturacionColumns";

type EstadoFactura = Database["public"]["Enums"]["estado_factura"];
const ESTADOS_FACTURA: EstadoFactura[] = ['Borrador', 'Emitida', 'Parcialmente pagada', 'Pagada', 'Vencida', 'Cancelada'];

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

      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={p.columns}
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
