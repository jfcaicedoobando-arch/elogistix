import { CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface Props {
  porcentajeAtendidos: number;
  totalRevisados: number;
  totalPendientes: number;
  edadPromediaPendientesDias: number | null;
}

export function EjecutivoAtencionCard({
  porcentajeAtendidos,
  totalRevisados,
  totalPendientes,
  edadPromediaPendientesDias,
}: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          Atención de hallazgos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end gap-2">
          <div className="text-4xl font-bold tabular-nums text-foreground">
            {porcentajeAtendidos}
            <span className="text-xl text-muted-foreground">%</span>
          </div>
        </div>
        <Progress value={porcentajeAtendidos} className="h-2" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            <span className="font-semibold text-foreground tabular-nums">{totalRevisados}</span>{" "}
            revisados
          </span>
          <span>
            <span className="font-semibold text-foreground tabular-nums">{totalPendientes}</span>{" "}
            pendientes
          </span>
        </div>
        {edadPromediaPendientesDias !== null && (
          <div className="text-xs text-muted-foreground border-t pt-2">
            Edad promedio de hallazgos vencidos:{" "}
            <span className="font-semibold text-foreground tabular-nums">
              {edadPromediaPendientesDias}
            </span>{" "}
            {edadPromediaPendientesDias === 1 ? "día" : "días"}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
