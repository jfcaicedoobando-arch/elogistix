/**
 * Tarjeta de estatus del embarque en el tracking público: etapa actual,
 * ETD/ETA y avance de documentos (recibidos vs. faltantes).
 */
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CalendarClock, CalendarCheck2 } from "lucide-react";
import { getEstadoColor } from "@/lib/ui/uiMappings";
import { formatFechaEs } from "@/lib/formatters";

interface Props {
  estado: string;
  etd: string | null;
  eta: string | null;
  documentosRecibidos: number;
  documentosTotales: number;
}

function fecha(iso: string | null): string {
  if (!iso) return "Por confirmar";
  const f = formatFechaEs(iso);
  return f === "-" ? "Por confirmar" : f;
}

export function TrackingPublicoEstatus({
  estado,
  etd,
  eta,
  documentosRecibidos,
  documentosTotales,
}: Props) {
  const pct = documentosTotales === 0 ? 0 : Math.round((documentosRecibidos / documentosTotales) * 100);

  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
        <CardTitle>Estatus del embarque</CardTitle>
        <Badge className={getEstadoColor(estado)}>{estado}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-md border p-3">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5" /> Salida estimada (ETD)
            </p>
            <p className="text-sm font-medium text-foreground">{fecha(etd)}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarCheck2 className="h-3.5 w-3.5" /> Llegada estimada (ETA)
            </p>
            <p className="text-sm font-medium text-foreground">{fecha(eta)}</p>
          </div>
        </div>

        {documentosTotales > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Documentos recibidos</span>
              <span>
                {documentosRecibidos} de {documentosTotales}
              </span>
            </div>
            <Progress value={pct} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
