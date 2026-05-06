import { AlertCircle, CalendarClock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Props {
  pendientesVencidos: number;
  pendientesUrgentesPorEta: number;
  onRevisarVencidos?: () => void;
}

export function EjecutivoAlertasUrgencia({
  pendientesVencidos,
  pendientesUrgentesPorEta,
  onRevisarVencidos,
}: Props) {
  if (pendientesVencidos === 0 && pendientesUrgentesPorEta === 0) return null;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {pendientesVencidos > 0 && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-destructive">
                {pendientesVencidos} hallazgo
                {pendientesVencidos === 1 ? "" : "s"} en embarques con ETA vencida
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Embarques que ya debieron arribar y aún tienen pendientes sin atender.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={onRevisarVencidos}>
              Revisar
            </Button>
          </CardContent>
        </Card>
      )}
      {pendientesUrgentesPorEta > 0 && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="p-4 flex items-start gap-3">
            <CalendarClock className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-warning">
                {pendientesUrgentesPorEta} hallazgo
                {pendientesUrgentesPorEta === 1 ? "" : "s"} con ETA en ≤ 3 días
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Atender antes del arribo para no impactar entrega al cliente.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
