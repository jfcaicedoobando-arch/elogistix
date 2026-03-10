import { TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { formatCurrency } from "@/lib/formatters";
import type { EmbarqueConProfit } from "@/hooks/useDashboardData";

interface Props {
  embarques: EmbarqueConProfit[];
  isLoading: boolean;
}

const columns: DataTableColumn<EmbarqueConProfit>[] = [
  { key: "expediente", header: "Expediente", className: "font-medium", render: (e) => e.expediente },
  { key: "cliente", header: "Cliente", className: "max-w-[180px] truncate", render: (e) => e.cliente_nombre },
  { key: "venta", header: "Venta USD", className: "text-right tabular-nums", headerClassName: "text-right", render: (e) => formatCurrency(e.ventaUSD, "USD") },
  { key: "costo", header: "Costo USD", className: "text-right tabular-nums", headerClassName: "text-right", render: (e) => formatCurrency(e.costoUSD, "USD") },
  {
    key: "profit", header: "Profit", className: "text-right font-semibold tabular-nums", headerClassName: "text-right",
    render: (e) => (
      <span className={e.profit >= 0 ? "text-success" : "text-destructive"}>
        {formatCurrency(e.profit, "USD")}
      </span>
    ),
  },
  {
    key: "margen", header: "Margen", className: "text-right", headerClassName: "text-right",
    render: (e) => (
      <Badge className={`text-[10px] ${
        e.margen > 15 ? "bg-success/15 text-success border-success/30"
          : e.margen > 0 ? "bg-warning/15 text-warning border-warning/30"
          : "bg-destructive/15 text-destructive border-destructive/30"
      }`}>
        {e.margen.toFixed(1)}%
      </Badge>
    ),
  },
];

export function ProfitTable({ embarques, isLoading }: Props) {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-success" />
          Profit USD — Arribos este mes
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto max-h-[320px]">
          <DataTable
            columns={columns}
            data={embarques}
            isLoading={isLoading}
            emptyMessage="Sin embarques con arribo este mes"
            onRowClick={(e) => navigate(`/embarques/${e.id}`)}
            rowKey={(e) => e.id}
            skeletonRows={4}
          />
        </div>
      </CardContent>
    </Card>
  );
}
