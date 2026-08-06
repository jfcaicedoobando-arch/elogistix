/**
 * Bar chart con top 5 funciones por errores.
 * Extraído de `DiagnosticoHealthPanel`.
 */
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartSkeleton } from "@/components/shared/ChartSkeleton";

interface Row {
  fn: string;
  errors: number;
}

interface Props {
  loading: boolean;
  data: Row[];
}

export default function HealthTopErrorsChart({ loading, data }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="font-medium">Top 5 funciones con errores</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <ChartSkeleton height={176} />
        ) : data.length === 0 ? (
          <div className="text-xs text-muted-foreground py-10 text-center">
            Sin errores en el rango seleccionado.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="fn" tick={{ fontSize: 11 }} width={140} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  fontSize: 12,
                }}
              />
              <Bar dataKey="errors" fill="hsl(var(--destructive))" name="Errores" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
