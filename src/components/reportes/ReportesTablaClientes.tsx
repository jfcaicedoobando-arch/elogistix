import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/formatters";

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

const arrow = (active: boolean, dir: "asc" | "desc") => (active ? (dir === "desc" ? "↓" : "↑") : "");

export default function ReportesTablaClientes({ data, isLoading, sortField, sortDir, onSort }: Props) {
  const navigate = useNavigate();

  return (
    <Card className="lg:col-span-3 rounded-2xl shadow-sm border-0 bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Desglose por Cliente</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[400px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-center">Embarques</TableHead>
                <TableHead className="text-right cursor-pointer select-none" onClick={() => onSort("venta_usd")}>
                  Venta USD {arrow(sortField === "venta_usd", sortDir)}
                </TableHead>
                <TableHead className="text-right cursor-pointer select-none" onClick={() => onSort("costo_usd")}>
                  Costo USD {arrow(sortField === "costo_usd", sortDir)}
                </TableHead>
                <TableHead className="text-right cursor-pointer select-none" onClick={() => onSort("profit_usd")}>
                  Profit USD {arrow(sortField === "profit_usd", sortDir)}
                </TableHead>
                <TableHead className="text-center cursor-pointer select-none" onClick={() => onSort("margen")}>
                  Margen {arrow(sortField === "margen", sortDir)}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Sin datos en el periodo seleccionado
                  </TableCell>
                </TableRow>
              ) : (
                data.map((c) => (
                  <TableRow key={c.cliente_id} className="cursor-pointer" onClick={() => navigate(`/clientes/${c.cliente_id}`)}>
                    <TableCell className="font-medium max-w-[200px] truncate">{c.cliente_nombre}</TableCell>
                    <TableCell className="text-center">{c.total_embarques}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(c.venta_usd, "USD")}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(c.costo_usd, "USD")}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{formatCurrency(c.profit_usd, "USD")}</TableCell>
                    <TableCell className="text-center">{margenBadge(c.margen)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
