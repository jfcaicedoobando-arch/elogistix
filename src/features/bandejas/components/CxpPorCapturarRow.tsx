/**
 * Renglón individual de la bandeja CxP — Por capturar.
 * Muestra avance, badge contextual y botón "Capturar factura".
 */
import { Link } from "react-router-dom";
import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { TableCell, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { CxpPorCapturarRow as RowData } from "@/features/bandejas/services/bandejas";
import { estatusDeFila } from "@/features/bandejas/hooks/useCxpPorCapturarFilters";

interface Props {
  row: RowData;
  onCapturar: (row: RowData) => void;
}

function AvanceBadge({ row }: { row: RowData }) {
  const estatus = estatusDeFila(row);
  if (estatus === "sin") return <Badge variant="secondary">Sin captura</Badge>;
  if (estatus === "parcial")
    return <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30 hover:bg-amber-500/20">Parcial</Badge>;
  return <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 hover:bg-emerald-500/20">Completo</Badge>;
}

function UltimaFactura({ row }: { row: RowData }) {
  if (!row.ultima_factura_fecha) {
    return <span className="text-muted-foreground">—</span>;
  }
  const dias = row.dias_desde_ultima_factura ?? 0;
  const chipClass =
    dias > 30 ? "text-destructive" : dias > 7 ? "text-amber-600" : "text-muted-foreground";
  return (
    <div className="flex flex-col">
      <span>{formatDate(row.ultima_factura_fecha)}</span>
      <span className={cn("text-xs tabular-nums", chipClass)}>hace {dias} d</span>
    </div>
  );
}

export function CxpPorCapturarRow({ row, onCapturar }: Props) {
  const presup = Number(row.costos_presupuestados) || 0;
  const fact = Number(row.monto_facturado) || 0;
  const pct = presup > 0 ? Math.min(100, Math.round((fact / presup) * 100)) : 0;

  return (
    <TableRow className="hover:bg-muted/50 odd:bg-muted/10">
      <TableCell className="font-mono text-sm">
        <Link to={`/embarques/${row.embarque_id}`} className="text-primary hover:underline">
          {row.expediente ?? "—"}
        </Link>
      </TableCell>
      <TableCell className="max-w-[200px] truncate" title={row.cliente_nombre ?? ""}>
        {row.cliente_nombre ?? "—"}
      </TableCell>
      <TableCell className="w-[180px]">
        <div className="flex items-center gap-2">
          <Progress value={pct} className="h-2 flex-1" />
          <span className="text-xs tabular-nums text-muted-foreground w-9 text-right">{pct}%</span>
        </div>
        <div className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
          {formatCurrency(fact, "MXN")} / {formatCurrency(presup, "MXN")}
        </div>
      </TableCell>
      <TableCell className="text-center">
        <AvanceBadge row={row} />
      </TableCell>
      <TableCell className="text-center tabular-nums">{row.facturas_capturadas}</TableCell>
      <TableCell className="text-sm">
        <UltimaFactura row={row} />
      </TableCell>
      <TableCell className="text-right">
        <Button size="sm" onClick={() => onCapturar(row)}>
          <FileText className="h-3.5 w-3.5 mr-1.5" />
          Capturar factura
        </Button>
      </TableCell>
    </TableRow>
  );
}
