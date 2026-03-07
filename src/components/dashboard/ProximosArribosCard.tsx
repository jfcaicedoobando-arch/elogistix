import { CalendarClock, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, getModoIcon } from "@/lib/helpers";
import type { ProximoArribo } from "@/hooks/useDashboardData";

interface Props {
  arribos: ProximoArribo[];
  isLoading: boolean;
}

export function ProximosArribosCard({ arribos, isLoading }: Props) {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-warning" />
          Próximos Arribos (7 días)
          {arribos.length > 0 && (
            <Badge className="ml-auto text-[10px] bg-warning/15 text-warning border-warning/30">
              {arribos.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 max-h-[280px] overflow-y-auto">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))
        ) : arribos.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Sin arribos próximos
          </p>
        ) : (
          arribos.map((e) => (
            <div
              key={e.id}
              onClick={() => navigate(`/embarques/${e.id}`)}
              className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <div className="shrink-0 h-9 w-9 rounded-full bg-warning/15 flex items-center justify-center">
                <Clock className="h-4 w-4 text-warning" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">
                  {e.expediente} — {e.cliente_nombre}
                </p>
                <p className="text-xs text-muted-foreground">
                  ETA: {formatDate(e.eta!)} ·{" "}
                  {e.diasRestantes === 0
                    ? "Hoy"
                    : `${e.diasRestantes} día${e.diasRestantes > 1 ? "s" : ""}`}
                </p>
              </div>
              <span className="text-lg">{getModoIcon(e.modo)}</span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
