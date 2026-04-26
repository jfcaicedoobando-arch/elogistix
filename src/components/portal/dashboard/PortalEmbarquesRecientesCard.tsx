import { Ship, ArrowRight, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { getEstadoColor, getModoIcon } from "@/lib/ui/uiMappings";
import { calcularEstadoEmbarque } from "@/lib/domain/embarque";
import { formatDate, getOrigen, getDestino } from "@/lib/formatters";

interface EmbarqueItem {
  id: string;
  expediente: string;
  modo: string;
  tipo?: string | null;
  etd?: string | null;
  eta?: string | null;
  estado?: string | null;
  puerto_origen?: string;
  aeropuerto_origen?: string;
  ciudad_origen?: string;
  puerto_destino?: string;
  aeropuerto_destino?: string;
  ciudad_destino?: string;
}

interface Props {
  embarques: EmbarqueItem[];
  className?: string;
}

export function PortalEmbarquesRecientesCard({ embarques, className }: Props) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Ship className="h-4 w-4 text-accent" />
            Embarques Recientes
          </CardTitle>
          <Link to="/portal/embarques">
            <Button variant="ghost" size="sm" className="text-xs h-7">
              Ver todos <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {embarques.length === 0 ? (
          <div className="text-center py-8">
            <Ship className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No hay embarques activos.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {embarques.slice(0, 5).map((e) => {
              const estadoVisual = calcularEstadoEmbarque(e.modo, e.tipo, e.etd, e.eta, e.estado);
              return (
                <Link
                  key={e.id}
                  to={`/portal/embarques/${e.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-lg flex-shrink-0">{getModoIcon(e.modo)}</span>
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{e.expediente}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">
                          {getOrigen(e)} → {getDestino(e)}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    {e.eta && (
                      <span className="text-[10px] text-muted-foreground hidden sm:block">
                        ETA {formatDate(e.eta, "dd/MM")}
                      </span>
                    )}
                    <Badge className={getEstadoColor(estadoVisual)}>{estadoVisual}</Badge>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
