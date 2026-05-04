import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { formatCurrency, toTitleCase } from "@/lib/formatters";

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

const margenBadge = (m: number) => {
  if (m >= 20) return <Badge variant="success">{m.toFixed(1)}%</Badge>;
  if (m >= 10) return <Badge variant="warning">{m.toFixed(1)}%</Badge>;
  return <Badge variant="destructive">{m.toFixed(1)}%</Badge>;
};

const SORT_KEYS: SortField[] = ["venta_usd", "costo_usd", "profit_usd", "margen"];

export default function ReportesTablaClientes({ data, isLoading, sortField, sortDir, onSort }: Props) {
  const navigate = useNavigate();

  const columns: DataTableColumn<ClienteRow>[] = [
    { key: "cliente", header: "Cliente", className: "font-medium max-w-[200px] truncate",
      render: (c) => <span title={toTitleCase(c.cliente_nombre)}>{toTitleCase(c.cliente_nombre)}</span> },
    { key: "embarques", header: "Embarques", align: "center", render: (c) => c.total_embarques },
    { key: "venta_usd", header: "Venta USD", align: "right", className: "tabular-nums", sortable: true, render: (c) => formatCurrency(c.venta_usd, "USD") },
    { key: "costo_usd", header: "Costo USD", align: "right", className: "tabular-nums", sortable: true, render: (c) => formatCurrency(c.costo_usd, "USD") },
    { key: "profit_usd", header: "Profit USD", align: "right", className: "tabular-nums font-semibold", sortable: true, render: (c) => formatCurrency(c.profit_usd, "USD") },
    { key: "margen", header: "Margen", align: "center", sortable: true, render: (c) => margenBadge(c.margen) },
  ];

  return (
    <Card className="rounded-2xl shadow-sm border-0 bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Desglose por Cliente</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[400px] overflow-auto">
          <DataTable
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
          />
        </div>
      </CardContent>
    </Card>
  );
}
