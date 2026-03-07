import { AlertTriangle, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { AlertaDemora } from "@/hooks/useDashboardData";

interface Props {
  alertas: AlertaDemora[];
  isLoading: boolean;
}

export function AlertasDemoraCard({ alertas, isLoading }: Props) {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          Alertas de Demora
          {alertas.length > 0 && (
            <Badge variant="destructive" className="ml-auto text-[10px]">
              {alertas.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 max-h-[280px] overflow-y-auto">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))
        ) : alertas.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Sin alertas de demora
          </p>
        ) : (
          alertas.map((e) => (
            <div
              key={e.id}
              onClick={() => navigate(`/embarques/${e.id}`)}
              className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <div
                className={`shrink-0 h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                  e.diasDemora >= 5 ? "bg-destructive" : "bg-warning"
                }`}
              >
                {e.diasDemora}d
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{e.expediente}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {e.cliente_nombre}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
