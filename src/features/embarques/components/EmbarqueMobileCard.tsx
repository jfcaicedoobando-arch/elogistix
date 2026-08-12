/**
 * Tarjeta móvil de una fila del listado de embarques.
 * Extraída de `Embarques.tsx` (límite Power-of-10 de 200 líneas).
 */
import { Badge } from "@/components/ui/badge";
import { ModoIcon } from "@/components/shared/ModoIcon";
import { formatDate, getOrigen, getDestino, shortName, toTitleCase } from "@/lib/formatters";
import { getEstadoColor } from "@/lib/ui/uiMappings";
import { calcularEstadoEmbarque } from "@/features/embarques/hooks";

export interface EmbarqueMobileCardData {
  modo: Parameters<typeof calcularEstadoEmbarque>[0];
  tipo: Parameters<typeof calcularEstadoEmbarque>[1];
  etd: Parameters<typeof calcularEstadoEmbarque>[2];
  eta: Parameters<typeof calcularEstadoEmbarque>[3];
  estado: Parameters<typeof calcularEstadoEmbarque>[4];
  fecha_llegada_real: Parameters<typeof calcularEstadoEmbarque>[5];
  expediente: string;
  cliente_nombre: string | null;
  puerto_origen?: string | null;
  aeropuerto_origen?: string | null;
  ciudad_origen?: string | null;
  puerto_destino?: string | null;
  aeropuerto_destino?: string | null;
  ciudad_destino?: string | null;
}

export function EmbarqueMobileCard({ embarque: e }: { embarque: EmbarqueMobileCardData }) {
  const estado = calcularEstadoEmbarque(e.modo, e.tipo, e.etd, e.eta, e.estado, e.fecha_llegada_real);
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 font-semibold text-sm">
          <ModoIcon modo={e.modo} size={14} />
          <span className="truncate">{e.expediente}</span>
        </div>
        <div className="text-xs text-muted-foreground truncate mt-0.5">
          {toTitleCase(e.cliente_nombre)}
        </div>
        <div className="text-label text-muted-foreground truncate mt-0.5">
          {shortName(getOrigen(e))} → {shortName(getDestino(e))}
          {e.eta ? ` · ETA ${formatDate(e.eta)}` : ""}
        </div>
      </div>
      <Badge variant="secondary" className={`text-2xs whitespace-nowrap ${getEstadoColor(estado)}`}>{estado}</Badge>
    </div>
  );
}
