import { memo } from "react";
import { CalendarClock, Clock, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ListSkeleton } from "@/components/shared/states/ListSkeleton";
import { formatDate, toTitleCase } from "@/lib/formatters";
import { ModoIcon } from "@/components/shared/ModoIcon";
import type { ProximoArribo } from "@/features/dashboard/hooks";

interface Props {
  arribos: ProximoArribo[];
  isLoading: boolean;
}

function formatDiasRestantes(dias: number): string {
  if (dias === 0) return "Hoy";
  return `${dias} día${dias > 1 ? "s" : ""}`;
}

/**
 * v13.223.0 · Capa 3 Tranche A · 1.3:
 * Chevron `ArrowRight` a la derecha (misma affordance que `AlertasDemoraCard`).
 * `ModoIcon` movido al subtítulo como identificador informativo, no como CTA.
 */
export const ProximosArribosCard = memo(function ProximosArribosCard({ arribos, isLoading }: Props) {
  const navigate = useNavigate();

  function renderBody() {
    if (isLoading) {
      return <ListSkeleton rows={3} />;
    }
    if (arribos.length === 0) {
      return (
        <p className="text-sm text-muted-foreground text-center py-6">
          Sin arribos próximos
        </p>
      );
    }
    return arribos.map((e) => (
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
            {e.expediente} — {toTitleCase(e.cliente_nombre)}
          </p>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <ModoIcon modo={e.modo} size={12} />
            <span className="truncate">
              ETA: {formatDate(e.eta!)} · {formatDiasRestantes(e.diasRestantes)}
            </span>
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
          <CalendarClock className="h-4 w-4 text-warning" />
          Próximos Arribos (7 días)
          {arribos.length > 0 && (
            <Badge className="ml-auto text-2xs bg-warning/15 text-warning border-warning/30">
              {arribos.length}
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
