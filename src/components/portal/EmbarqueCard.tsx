import { memo } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getEstadoColor, getEstadoBorderColor, getModoCircleStyle, getModoLucideIcon } from "@/lib/ui/uiMappings";
import { calcularEstadoEmbarque } from "@/lib/domain/embarque";
import { formatDate, getOrigen, getDestino } from "@/lib/formatters";
import { MapPin, Anchor, Plane, Truck, CalendarClock } from "lucide-react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

export interface EmbarqueCardData {
  id: string;
  expediente: string;
  modo: string;
  tipo: string;
  estado: string;
  etd: string | null;
  eta: string | null;
  puerto_origen: string | null;
  aeropuerto_origen: string | null;
  ciudad_origen: string | null;
  puerto_destino: string | null;
  aeropuerto_destino: string | null;
  ciudad_destino: string | null;
  naviera: string | null;
  aerolinea: string | null;
  transportista: string | null;
  contenedor: string | null;
  tipo_contenedor: string | null;
  tipo_servicio: string | null;
  fecha_llegada_real?: string | null;
}

/** Color del ETA según proximidad: <3 días destructive, <7 warning, resto muted. */
function etaProximityClass(eta: string | null | undefined): string {
  if (!eta) return "text-muted-foreground";
  try {
    const days = differenceInCalendarDays(parseISO(eta), new Date());
    if (days < 0) return "text-muted-foreground";
    if (days < 3) return "text-destructive font-semibold";
    if (days < 7) return "text-[hsl(var(--warning))] font-semibold";
    return "text-muted-foreground";
  } catch {
    return "text-muted-foreground";
  }
}

function EmbarqueCardInner({ e }: { e: EmbarqueCardData }) {
  const estadoVisual = calcularEstadoEmbarque(e.modo, e.tipo, e.etd, e.eta, e.estado);
  const origen = getOrigen(e);
  const destino = getDestino(e);
  const carrier = e.naviera || e.aerolinea || e.transportista;
  const tipoLabel = e.tipo_servicio
    ? `${e.tipo_servicio}${e.tipo_contenedor ? ` ${e.tipo_contenedor}` : ""}`
    : e.modo === "Aéreo" ? "Aéreo" : null;
  const etaCls = etaProximityClass(e.eta);

  return (
    <Link to={`/portal/embarques/${e.id}`}>
      <Card className={`border-l-4 ${getEstadoBorderColor(estadoVisual)} hover:shadow-md hover:scale-[1.005] transition-all duration-200 group`}>
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`rounded-full p-2 flex-shrink-0 ${getModoCircleStyle(e.modo)}`}>
                {(() => { const Icon = getModoLucideIcon(e.modo); return <Icon className="h-5 w-5" />; })()}
              </div>
              <p className="font-semibold text-sm truncate font-mono tabular-nums">
                {e.expediente}{e.contenedor ? ` — ${e.contenedor}` : ""}
              </p>
            </div>
            <Badge className={`${getEstadoColor(estadoVisual)} flex-shrink-0 text-xs px-2.5 py-0.5`}>
              {estadoVisual}
            </Badge>
          </div>

          <div className="flex items-center justify-between gap-2 pl-[52px]">
            <span className="text-xs text-muted-foreground flex items-center gap-1 truncate">
              <MapPin className="h-3 w-3 flex-shrink-0" />
              {origen} → {destino}
            </span>
            {tipoLabel && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 flex-shrink-0 font-normal">
                {tipoLabel}
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-between gap-4 pl-[52px] flex-wrap">
            <div className="flex items-center gap-4">
              {carrier && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  {e.modo === "Marítimo" ? <Anchor className="h-3 w-3" /> : e.modo === "Aéreo" ? <Plane className="h-3 w-3" /> : <Truck className="h-3 w-3" />}
                  {carrier}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs text-muted-foreground flex items-center gap-1 tabular-nums">
                <CalendarClock className="h-3 w-3 flex-shrink-0" />
                ETD: {formatDate(e.etd || "", "dd/MM/yy")}
              </span>
              <span className={cn("text-xs flex items-center gap-1 tabular-nums", etaCls)}>
                <CalendarClock className="h-3 w-3 flex-shrink-0" />
                ETA: {formatDate(e.eta || "", "dd/MM/yy")}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

const EmbarqueCard = memo(EmbarqueCardInner);
export default EmbarqueCard;
