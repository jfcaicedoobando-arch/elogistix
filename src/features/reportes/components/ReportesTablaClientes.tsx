import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { ResponsiveDataTable } from "@/components/shared/dataTable/ResponsiveDataTable";
import { formatCurrency, toTitleCase } from "@/lib/formatters";
import { MargenBadge } from "@/components/shared/MargenBadge";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";

export type SortField = "profit_usd" | "venta_usd" | "costo_usd" | "margen";

interface ClienteRow {
  cliente_id: string;
  cliente_nombre: string;
  total_embarques: number;
  venta_usd: number;
  costo_usd: number;
  profit_usd: number;
  margen: number;
}

interface Props {
  data: ClienteRow[];
  isLoading: boolean;
  sortField: SortField;
  sortDir: "asc" | "desc";
  onSort: (field: SortField) => void;
}

const margenBadge = (m: number, venta = 0) => <MargenBadge pct={m} venta={venta} />;

const SORT_KEYS: SortField[] = ["venta_usd", "costo_usd", "profit_usd", "margen"];

export default function ReportesTablaClientes({ data, isLoading, sortField, sortDir, onSort }: Props) {
  const navigate = useNavigate();

  const columns: ColumnDef<ClienteRow, unknown>[] = defineColumns<ClienteRow>([
    { id: "cliente", header: "Cliente", meta: { className: "font-medium max-w-[200px] truncate" },
      cell: ({ row }) => <span title={toTitleCase(row.original.cliente_nombre)}>{toTitleCase(row.original.cliente_nombre)}</span> },
    { id: "embarques", header: "Embarques", meta: { align: "center" }, cell: ({ row }) => row.original.total_embarques },
    { id: "venta_usd", header: "Venta USD", enableSorting: true, meta: { align: "right", className: "tabular-nums" }, cell: ({ row }) => formatCurrency(row.original.venta_usd, "USD") },
    { id: "costo_usd", header: "Costo USD", enableSorting: true, meta: { align: "right", className: "tabular-nums" }, cell: ({ row }) => formatCurrency(row.original.costo_usd, "USD") },
    { id: "profit_usd", header: "Utilidad USD", enableSorting: true, meta: { align: "right", className: "tabular-nums font-semibold" }, cell: ({ row }) => formatCurrency(row.original.profit_usd, "USD") },
    { id: "margen", header: "Margen", enableSorting: true, meta: { align: "center" }, cell: ({ row }) => margenBadge(row.original.margen, row.original.venta_usd) },
  ]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Desglose por Cliente</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[400px] overflow-auto">
          <ResponsiveDataTable
            columns={columns}
            data={data}
            isLoading={isLoading}
            rowKey={(c) => c.cliente_id}
            onRowClick={(c) => navigate(`/clientes/${c.cliente_id}`)}
            sortMode="server"
            controlledSort={{ key: sortField, dir: sortDir }}
            onSortChange={(key) => {
              if (key && SORT_KEYS.includes(key as SortField)) onSort(key as SortField);
            }}
            emptyMessage="Sin datos en el periodo seleccionado"
            density={TABLE_DENSITY.embebida}
            mobileCard={(c) => (
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm truncate">{toTitleCase(c.cliente_nombre)}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{c.total_embarques} embarques · Venta {formatCurrency(c.venta_usd, "USD")}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 tabular-nums">Utilidad: {formatCurrency(c.profit_usd, "USD")}</div>
                </div>
                {margenBadge(c.margen, c.venta_usd)}
              </div>
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
}
