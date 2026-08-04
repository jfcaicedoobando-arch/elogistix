/**
 * Leaderboard de vendedores (Sprint D).
 * 11.13.0: queries movidas a `useLeaderboardVendedores`.
 */
import { Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatCurrencyCompact } from "@/lib/formatters";
import { useLeaderboardVendedores } from "@/features/crm/hooks";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";

export default function LeaderboardVendedores() {
  const { data = [], isLoading } = useLeaderboardVendedores();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Trophy className="h-4 w-4" /> Leaderboard del mes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <EmptyStateInline loading message="Cargando…" />
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin actividad de cierre este mes.</p>
        ) : (
          <ul className="space-y-3">
            {data.map((f) => (
              <li key={f.vendedor} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium truncate max-w-[60%]">{f.vendedor}</span>
                  <span className="text-muted-foreground">
                    {formatCurrencyCompact(f.cerrado, "MXN")}
                    {f.cuota > 0 && <> / {formatCurrencyCompact(f.cuota, "MXN")}</>}
                  </span>
                </div>
                <Progress value={f.avance} className="h-2" />
                <div className="text-xs text-muted-foreground text-right">{f.avance}%</div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
