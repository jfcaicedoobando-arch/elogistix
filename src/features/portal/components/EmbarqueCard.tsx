import { memo } from "react";
import { useDrilldownRow } from "@/components/shared/dataTable/useDrilldownRow";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getEstadoColor, getEstadoBorderColor, getModoCircleStyle, getModoLucideIcon } from "@/lib/ui/uiMappings";
import { calcularEstadoEmbarque } from "@/features/embarques/domain/embarque";
import { labelExpediente } from "@/lib/domain/labelExpediente";
import { formatDate, getOrigen, getDestino } from "@/lib/formatters";
import { MapPin, CalendarClock } from "lucide-react";
import { differenceInCalendarDays } from "date-fns";
import { parseDateOnlyLocal } from "@/lib/date/dateOnly";
import { cn } from "@/lib/utils";

export interface EmbarqueCardData {
  id: string;
  expediente: string | null;
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
}

/** Color del ETA según proximidad: <3 días destructive, <7 warning, resto muted. */
function etaProximityClass(eta: string | null | undefined): string {
  if (!eta) return "text-muted-foreground";
  try {
    const days = differenceInCalendarDays(parseDateOnlyLocal(eta), new Date());
    if (days < 0) return "text-muted-foreground";
    if (days < 3) return "text-destructive font-semibold";
    if (days < 7) return "text-warning font-semibold";
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
  const rowNav = useDrilldownRow({
    href: `/portal/embarques/${e.id}`,
    ariaLabel: `Ver embarque ${labelExpediente(e.expediente, e.id)}`,
  });

  return (
    <article {...rowNav} className={cn(rowNav.className, "block")}>
      <Card className={`border-l-4 ${getEstadoBorderColor(estadoVisual)} hover:shadow-raised hover:scale-[1.005] transition-all duration-200 group`}>
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`rounded-full p-2 flex-shrink-0 ${getModoCircleStyle(e.modo)}`}>
                {(() => { const Icon = getModoLucideIcon(e.modo); return <Icon className="h-5 w-5" />; })()}
              </div>
              <p className="font-semibold text-sm truncate font-mono tabular-nums">
                {labelExpediente(e.expediente, e.id)}{e.contenedor ? ` — ${e.contenedor}` : ""}
              </p>
            </div>
            <Badge className={`${getEstadoColor(estadoVisual)} flex-shrink-0 text-xs px-2.5 py-0.5`}>
              {estadoVisual}
            </Badge>
          </div>

          <div className="flex items-center justify-between gap-2 sm:pl-12">
            <span className="text-xs text-muted-foreground flex items-center gap-1 truncate min-w-0">
              <MapPin className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{origen} → {destino}</span>
            </span>
            {tipoLabel && (
              <Badge variant="outline" className="hidden sm:flex text-2xs px-1.5 py-0 flex-shrink-0 font-normal">
                {tipoLabel}
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 sm:pl-12 flex-wrap">
            {carrier && (() => {
              const CarrierIcon = getModoLucideIcon(e.modo);
              return (
                <span className="text-xs text-muted-foreground flex items-center gap-1 truncate min-w-0">
                  <CarrierIcon className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{carrier}</span>
                </span>
              );
            })()}
            <div className="flex items-center gap-3 ml-auto">
              <span className="text-xs text-muted-foreground flex items-center gap-1 tabular-nums" title="Fecha estimada de salida">
                <CalendarClock className="h-3 w-3 flex-shrink-0" />
                ETD: {formatDate(e.etd || "", "dd/MM/yy")}
              </span>
              <span className={cn("text-xs flex items-center gap-1 tabular-nums", etaCls)} title="Fecha estimada de arribo">
                <CalendarClock className="h-3 w-3 flex-shrink-0" />
                ETA: {formatDate(e.eta || "", "dd/MM/yy")}
              </span>
            </div>
          </div>

        </CardContent>
      </Card>
    </article>
  );
}

const EmbarqueCard = memo(EmbarqueCardInner);
export default EmbarqueCard;
