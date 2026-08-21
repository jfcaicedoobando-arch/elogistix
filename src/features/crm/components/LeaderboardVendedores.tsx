/**
 * Leaderboard de vendedores (Sprint D).
 * 11.13.0: queries movidas a `useLeaderboardVendedores`.
 * OLA 7 · O7.8: el RLS puede dejar sólo la fila del vendedor; en ese caso el
 * título dice "Tu desempeño del mes" para no dar a entender que va ganando.
 */
import { Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatCurrencyCompact } from "@/lib/formatters";
import { useLeaderboardVendedores } from "@/features/crm/hooks";
import { useAuth } from "@/lib/contexts/AuthContext";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";

export default function LeaderboardVendedores() {
  const { data = [], isLoading } = useLeaderboardVendedores();
  const { user } = useAuth();
  const soloYo =
    data.length === 1 &&
    !!user?.email &&
    data[0].vendedor.toLowerCase() === user.email.toLowerCase();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-4 w-4" /> {soloYo ? "Tu desempeño del mes" : "Leaderboard del mes"}
        </CardTitle>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <EmptyStateInline loading message="Cargando…" />
        ) : data.length === 0 ? (
          <EmptyStateInline icon={Trophy} message="Sin actividad de cierre este mes." />
        ) : (
          <ul className="space-y-3">
            {data.map((f) => (
              <li key={f.vendedor} className="space-y-1">
                <div className="flex justify-between text-body">
                  <span className="font-medium truncate max-w-[60%]">{f.vendedor}</span>
                  <span className="text-muted-foreground">
                    {formatCurrencyCompact(f.cerrado, "MXN")}
                    {f.cuota > 0 && <> / {formatCurrencyCompact(f.cuota, "MXN")}</>}
                  </span>
                </div>
                <Progress value={f.avance} className="h-2" />
                <div className="text-body-sm text-muted-foreground text-right">{f.avance}%</div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
