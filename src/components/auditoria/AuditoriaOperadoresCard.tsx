/**
 * Tarjetas de productividad de operadores: MTTR + ranking de resueltos.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Timer } from "lucide-react";
import type { OperadorRanking } from "@/hooks/auditoria";

interface Props {
  mttrHoras: number | null;
  ranking: OperadorRanking[];
}

function formatMttr(horas: number | null): string {
  if (horas === null) return "—";
  if (horas < 24) return `${horas} h`;
  const dias = Math.round(horas / 24);
  return `${dias} d`;
}

export function AuditoriaOperadoresCard({ mttrHoras, ranking }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Timer className="h-4 w-4" />
            Tiempo medio de resolución
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold tabular-nums">
            {formatMttr(mttrHoras)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Desde asignación hasta marca de revisado.
          </p>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4" />
            Productividad de operadores
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ranking.length === 0 ? (
            <div className="text-xs text-muted-foreground py-6 text-center">
              Aún no hay actividad de operadores registrada.
            </div>
          ) : (
            <div className="space-y-2">
              {ranking.map((op) => (
                <div
                  key={op.email}
                  className="flex items-center justify-between gap-2 text-xs border rounded-md p-2"
                >
                  <span className="truncate font-medium" title={op.email}>
                    {op.email}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="secondary" className="tabular-nums">
                      {op.resueltos} resueltos
                    </Badge>
                    {op.pendientes > 0 && (
                      <Badge variant="outline" className="tabular-nums">
                        {op.pendientes} pend.
                      </Badge>
                    )}
                    {op.vencidos > 0 && (
                      <Badge variant="destructive" className="tabular-nums">
                        {op.vencidos} venc.
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
