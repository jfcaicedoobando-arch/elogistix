/**
 * Leaderboard de vendedores (Sprint D).
 * 11.13.0: queries movidas a `useLeaderboardVendedores`.
 * OLA 7 · O7.8: el RLS puede dejar sólo la fila del vendedor; en ese caso el
 * título dice "Tu desempeño del mes" para no dar a entender que va ganando.
 * P1-5: cada vendedor puede tener filas por moneda distinta (nunca se
 * mezclan montos de monedas distintas: no hay TC histórico canónico).
 */
import { useMemo } from "react";
import { Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatCurrencyCompact } from "@/lib/formatters";
import { useLeaderboardVendedores } from "@/features/crm/hooks";
import type { LeaderboardRow } from "@/features/crm/services/leaderboard";
import { useAuth } from "@/lib/contexts/AuthContext";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { ErrorStateInline } from "@/components/empty/ErrorStateInline";

interface VendedorGrupo {
  vendedor: string;
  filas: LeaderboardRow[];
}

function agruparPorVendedor(data: LeaderboardRow[]): VendedorGrupo[] {
  const m = new Map<string, LeaderboardRow[]>();
  for (const r of data) {
    const arr = m.get(r.vendedor) ?? [];
    arr.push(r);
    m.set(r.vendedor, arr);
  }
  return Array.from(m.entries()).map(([vendedor, filas]) => ({ vendedor, filas }));
}

export default function LeaderboardVendedores() {
  const { data = [], isLoading, isError, refetch } = useLeaderboardVendedores();
  const { user } = useAuth();
  const grupos = useMemo(() => agruparPorVendedor(data), [data]);
  const soloYo =
    grupos.length === 1 &&
    !!user?.email &&
    grupos[0].vendedor.toLowerCase() === user.email.toLowerCase();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-4 w-4" /> {soloYo ? "Tu desempeño del mes" : "Leaderboard del mes"}
        </CardTitle>
      </CardHeader>

      <CardContent>
        {isError ? (
          <ErrorStateInline message="No se pudo cargar el leaderboard." onRetry={refetch} />
        ) : isLoading ? (
          <EmptyStateInline loading message="Cargando…" />
        ) : grupos.length === 0 ? (
          <EmptyStateInline icon={Trophy} message="Sin actividad de cierre este mes." />
        ) : (
          <ul className="space-y-4">
            {grupos.map((g) => (
              <li key={g.vendedor} className="space-y-2">
                <div className="font-medium truncate max-w-[80%] text-body">{g.vendedor}</div>
                {g.filas.map((f) => (
                  <div key={f.moneda} className="space-y-1">
                    <div className="flex justify-between text-body-sm">
                      <span className="text-muted-foreground">{f.moneda}</span>
                      <span className="text-muted-foreground">
                        {formatCurrencyCompact(f.cerrado, f.moneda)}
                        {f.cuota > 0 && <> / {formatCurrencyCompact(f.cuota, f.moneda)}</>}
                      </span>
                    </div>
                    <Progress value={f.avance} className="h-2" />
                    <div className="text-body-sm text-muted-foreground text-right">{f.avance}%</div>
                  </div>
                ))}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
