import { memo } from "react";
import { TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { formatCurrency, toTitleCase } from "@/lib/formatters";
import type { EmbarqueConProfit } from "@/hooks/dashboard";

interface Props {
  embarques: EmbarqueConProfit[];
  isLoading: boolean;
}

function MoneyWithBreakdown({ e, value }: { e: EmbarqueConProfit; value: number }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`cursor-help ${value >= 0 ? "text-success" : "text-destructive"}`}>
            {formatCurrency(value, "MXN")}
          </span>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-xs">
          <div className="space-y-1 text-xs">
            <div className="font-semibold border-b pb-1 mb-1">Desglose homologado a MXN</div>
            <div className="flex justify-between gap-3"><span className="text-muted-foreground">Venta:</span><span className="tabular-nums">{formatCurrency(e.ventaMXN, "MXN")}</span></div>
            <div className="flex justify-between gap-3"><span className="text-muted-foreground">Costo:</span><span className="tabular-nums">{formatCurrency(e.costoMXN, "MXN")}</span></div>
            <div className="border-t pt-1 mt-1 space-y-0.5 text-[11px] text-muted-foreground">
              <div className="flex justify-between gap-3"><span>USD → MXN:</span><span className="tabular-nums">V {formatCurrency(e.ventaMxnFromUsd, "MXN")} · C {formatCurrency(e.costoMxnFromUsd, "MXN")}</span></div>
              <div className="flex justify-between gap-3"><span>EUR → MXN:</span><span className="tabular-nums">V {formatCurrency(e.ventaMxnFromEur, "MXN")} · C {formatCurrency(e.costoMxnFromEur, "MXN")}</span></div>
              <div className="flex justify-between gap-3"><span>MXN nativo:</span><span className="tabular-nums">V {formatCurrency(e.ventaMxnNative, "MXN")} · C {formatCurrency(e.costoMxnNative, "MXN")}</span></div>
              <div className="pt-1 italic">TC USD {e.tipoCambioUSD.toFixed(4)} · TC EUR {e.tipoCambioEUR.toFixed(4)}</div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const columns: DataTableColumn<EmbarqueConProfit>[] = [
  { key: "expediente", header: "Expediente", className: "font-medium", render: (e) => e.expediente },
  { key: "cliente", header: "Cliente", className: "max-w-[240px] truncate", render: (e) => <span title={e.cliente_nombre}>{toTitleCase(e.cliente_nombre)}</span> },
  { key: "venta", header: "Venta MXN", className: "text-right tabular-nums", headerClassName: "text-right", render: (e) => formatCurrency(e.ventaMXN, "MXN") },
  { key: "costo", header: "Costo MXN", className: "text-right tabular-nums", headerClassName: "text-right", render: (e) => formatCurrency(e.costoMXN, "MXN") },
  {
    key: "profit", header: "Profit MXN", className: "text-right font-semibold tabular-nums", headerClassName: "text-right",
    sortable: true, sortValue: (e) => e.profitMXN,
    render: (e) => <MoneyWithBreakdown e={e} value={e.profitMXN} />,
  },
  {
    key: "margen", header: "Margen", className: "text-right", headerClassName: "text-right",
    sortable: true, sortValue: (e) => e.margenMXN,
    render: (e) => (
      <Badge className={`text-[10px] ${
        e.margenMXN > 15 ? "bg-success/15 text-success border-success/30"
          : e.margenMXN > 0 ? "bg-warning/15 text-warning border-warning/30"
          : "bg-destructive/15 text-destructive border-destructive/30"
      }`}>
        {e.margenMXN.toFixed(1)}%
      </Badge>
    ),
  },
];

export const ProfitTable = memo(function ProfitTable({ embarques, isLoading }: Props) {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-success" />
          Profit MXN — Arribos este mes
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
            density="compact"
          />
        </div>
      </CardContent>
    </Card>
  );
});
