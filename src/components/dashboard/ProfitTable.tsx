import { TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/formatters";
import type { EmbarqueConProfit } from "@/hooks/useDashboardData";

interface Props {
  embarques: EmbarqueConProfit[];
  isLoading: boolean;
}

export function ProfitTable({ embarques, isLoading }: Props) {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-success" />
          Profit USD por Embarque
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : embarques.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Sin datos de conceptos USD
          </p>
        ) : (
          <div className="overflow-auto max-h-[320px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Expediente</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Venta USD</TableHead>
                  <TableHead className="text-right">Costo USD</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead className="text-right">Margen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {embarques.map((e) => (
                  <TableRow
                    key={e.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/embarques/${e.id}`)}
                  >
                    <TableCell className="font-medium">
                      {e.expediente}
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate">
                      {e.cliente_nombre}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(e.ventaUSD, "USD")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(e.costoUSD, "USD")}
                    </TableCell>
                    <TableCell
                      className={`text-right font-semibold tabular-nums ${
                        e.profit >= 0 ? "text-success" : "text-destructive"
                      }`}
                    >
                      {formatCurrency(e.profit, "USD")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        className={`text-[10px] ${
                          e.margen > 15
                            ? "bg-success/15 text-success border-success/30"
                            : e.margen > 0
                            ? "bg-warning/15 text-warning border-warning/30"
                            : "bg-destructive/15 text-destructive border-destructive/30"
                        }`}
                      >
                        {e.margen.toFixed(1)}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
