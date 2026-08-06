import { memo } from "react";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ListSkeleton } from "@/components/shared/states/ListSkeleton";
import type { AlertaDemora } from "@/features/dashboard/hooks";
import { toTitleCase } from "@/lib/formatters";

interface Props {
  alertas: AlertaDemora[];
  isLoading: boolean;
}

/**
 * R8: un badge "0d" no comunica nada. Con 0 días de demora la carga se venció
 * hoy, así que lo decimos con palabras.
 */
function etiquetaDemora(dias: number): { badge: string; titulo: string } {
  if (dias <= 0) return { badge: "Hoy", titulo: "Se vence hoy" };
  return { badge: `${dias}d`, titulo: `${dias} ${dias === 1 ? "día" : "días"} de demora` };
}


export const AlertasDemoraCard = memo(function AlertasDemoraCard({ alertas, isLoading }: Props) {
  const navigate = useNavigate();

  function renderBody() {
    if (isLoading) {
      return <ListSkeleton rows={3} />;
    }
    if (alertas.length === 0) {
      return (
        <p className="text-sm text-muted-foreground text-center py-6">
          Sin alertas de demora
        </p>
      );
    }
    return alertas.map((e) => (
            <div
              key={e.id}
              onClick={() => navigate(`/embarques/${e.id}`)}
              className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <div
                className={`shrink-0 h-9 w-9 rounded-full flex items-center justify-center text-2xs font-bold text-primary-foreground ${
                  e.diasDemora >= 5 ? "bg-destructive" : "bg-warning"
                }`}
                title={etiquetaDemora(e.diasDemora).titulo}
              >
                {etiquetaDemora(e.diasDemora).badge}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{e.expediente}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {toTitleCase(e.cliente_nombre)}
                </p>
              </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </div>
    ));
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          Alertas de Demora
          {alertas.length > 0 && (
            <Badge variant="destructive" className="ml-auto text-2xs">
              {alertas.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 max-h-[280px] overflow-y-auto">
        {renderBody()}
      </CardContent>
    </Card>
  );
});
