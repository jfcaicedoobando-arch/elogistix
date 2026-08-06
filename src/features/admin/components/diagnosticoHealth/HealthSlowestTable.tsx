/**
 * Tabla con top 5 funciones más lentas (p50/p95).
 * Extraído de `DiagnosticoHealthPanel`.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListSkeleton } from "@/components/shared/states/ListSkeleton";
import { formatNumber } from "@/lib/formatters";

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
          <div className="text-xs text-muted-foreground py-10 text-center">
            Sin mediciones de latencia.
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr className="border-b">
                <th className="text-left py-2 font-medium">Función</th>
                <th className="text-right py-2 font-medium">p50</th>
                <th className="text-right py-2 font-medium">p95</th>
                <th className="text-right py-2 font-medium">Eventos</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.fn} className="border-b last:border-0">
                  <td className="py-2 font-mono">{r.fn}</td>
                  <td className="py-2 text-right">{formatMs(r.p50_ms)}</td>
                  <td className="py-2 text-right font-medium">{formatMs(r.p95_ms)}</td>
                  <td className="py-2 text-right">{formatNumber(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
