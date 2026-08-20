/**
 * Tabla con top 5 funciones más lentas (p50/p95).
 * Extraído de `DiagnosticoHealthPanel`.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListSkeleton } from "@/components/shared/states/ListSkeleton";
import { formatNumber } from "@/lib/formatters";
import { Gauge } from "lucide-react";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";

import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { DetailTableHead } from "@/components/shared/DetailTable";
interface Row {
  fn: string;
  p50_ms: number | null;
  p95_ms: number | null;
  total: number;
}

function formatMs(v: number | null): string {
  if (v === null) return "—";
  return v >= 1000 ? `${(v / 1000).toFixed(2)} s` : `${Math.round(v)} ms`;
}

interface Props {
  loading: boolean;
  data: Row[];
}

export default function HealthSlowestTable({ loading, data }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="font-medium">Top 5 más lentas (p95)</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <ListSkeleton rows={5} />
        ) : data.length === 0 ? (
          <EmptyStateInline icon={Gauge} message="Sin mediciones de latencia." className="py-10" />
        ) : (
          <div className="overflow-x-auto">
          <Table className="w-full text-body-sm">
            <TableHeader className="text-muted-foreground">
              <TableRow className="border-b">
                <DetailTableHead>Función</DetailTableHead>
                <DetailTableHead className="text-right">p50</DetailTableHead>
                <DetailTableHead className="text-right">p95</DetailTableHead>
                <DetailTableHead className="text-right">Eventos</DetailTableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((r) => (
                <TableRow key={r.fn} className="border-b last:border-0">
                  <TableCell className="font-mono">{r.fn}</TableCell>
                  <TableCell className="text-right">{formatMs(r.p50_ms)}</TableCell>
                  <TableCell className="text-right font-medium">{formatMs(r.p95_ms)}</TableCell>
                  <TableCell className="text-right">{formatNumber(r.total)}</TableCell>
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
