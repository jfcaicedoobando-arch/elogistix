/**
 * Tendencia 12 meses (Ola 4): comprometido vs facturado vs pagado, en MXN.
 */
import { Card, CardContent } from "@/components/ui/card";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import { formatCurrency, formatCurrencyCompact } from "@/lib/formatters";
import type { PuntoTendencia } from "@/features/proveedor/domain/inteligenciaProveedor";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function etiquetaMes(mes: string): string {
  const [anio, m] = mes.split("-");
  const idx = Number(m) - 1;
  if (!MESES[idx]) return mes;
  return `${MESES[idx]} ${anio.slice(2)}`;
}

export function ProveedorTendenciaChart({ tendencia }: { tendencia: PuntoTendencia[] }) {
  const hayDatos = tendencia.some((p) => p.comprometido > 0 || p.facturado > 0 || p.pagado > 0);
  const data = tendencia.map((p) => ({ ...p, etiqueta: etiquetaMes(p.mes) }));

  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm font-semibold">Comprometido vs facturado vs pagado</p>
        <p className="text-xs text-muted-foreground mb-3">
          Últimos 12 meses, en pesos. El rezago entre las barras muestra qué tanto tarda el proveedor en facturar y qué tanto tardamos en pagarle.
        </p>
        {!hayDatos ? (
          <p className="text-sm text-muted-foreground text-center py-6">Sin movimientos en el período.</p>
        ) : (
          <div className="w-full h-72">
            <ResponsiveContainer>
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="etiqueta" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => formatCurrencyCompact(v, "MXN")} />
                <Tooltip formatter={(v: number) => formatCurrency(v, "MXN")} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar name="Comprometido" dataKey="comprometido" fill="hsl(var(--muted-foreground))" radius={[3, 3, 0, 0]} />
                <Bar name="Facturado" dataKey="facturado" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                <Bar name="Pagado" dataKey="pagado" fill="hsl(var(--success))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
