import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getEstadoColor, getEstadoBorderColor, getModoCircleStyle, getModoLucideIcon } from "@/lib/uiMappings";
import { calcularEstadoEmbarque } from "@/lib/embarqueLogic";
import { formatDate } from "@/lib/formatters";
import { MapPin, Anchor, Plane, Truck, CalendarClock } from "lucide-react";

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
}

export default function EmbarqueCard({ e }: { e: EmbarqueCardData }) {
  const estadoVisual = calcularEstadoEmbarque(e.modo, e.tipo, e.etd, e.eta, e.estado);
  const origen = e.puerto_origen || e.aeropuerto_origen || e.ciudad_origen || "—";
  const destino = e.puerto_destino || e.aeropuerto_destino || e.ciudad_destino || "—";
  const carrier = e.naviera || e.aerolinea || e.transportista;
  const tipoLabel = e.tipo_servicio
    ? `${e.tipo_servicio}${e.tipo_contenedor ? ` ${e.tipo_contenedor}` : ""}`
    : e.modo === "Aéreo" ? "Aéreo" : null;

  return (
    <Link to={`/portal/embarques/${e.id}`}>
      <Card className={`border-l-4 ${getEstadoBorderColor(estadoVisual)} hover:shadow-lg hover:scale-[1.01] transition-all duration-200 group`}>
        <CardContent className="p-4 space-y-2.5">
          {/* Row 1: Expediente + Estado */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`rounded-full p-2 flex-shrink-0 ${getModoCircleStyle(e.modo)}`}>
                {getModoLucideIcon(e.modo)}
              </div>
              <p className="font-semibold text-sm truncate">
                {e.expediente}{e.contenedor ? ` — ${e.contenedor}` : ""}
              </p>
            </div>
            <Badge className={`${getEstadoColor(estadoVisual)} flex-shrink-0 text-xs px-2.5 py-0.5`}>
              {estadoVisual}
            </Badge>
          </div>

          {/* Row 2: Ruta + Tipo */}
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

          {/* Row 3: Carrier + Dates */}
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
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <CalendarClock className="h-3 w-3 flex-shrink-0" />
                ETD: {formatDate(e.etd || "", "dd/MM/yy")}
              </span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
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
