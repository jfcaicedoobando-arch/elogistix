/**
 * Tarjeta móvil de la tabla de embarques del cliente (detalle de cliente).
 * Extraída al migrar `ClienteDetalleTablasTabs` de `DataTable` a `ResponsiveDataTable`.
 */
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ModoIcon } from "@/components/shared/ModoIcon";
import { formatDate, getOrigen, getDestino, shortName } from "@/lib/formatters";
import type { EmbarqueCliente } from "@/features/cliente/components/clienteColumns";

export function EmbarqueClienteMobileCard({ e }: { e: EmbarqueCliente }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 font-semibold text-body">
          <ModoIcon modo={e.modo} size={14} />
          <span className="truncate">{e.expediente}</span>
        </div>
        <div className="text-label text-muted-foreground truncate mt-0.5">
          {shortName(getOrigen(e))} → {shortName(getDestino(e))}
          {e.eta ? ` · ETA ${formatDate(e.eta)}` : ""}
        </div>
      </div>
      <StatusBadge domain="embarque" status={e.estado} className="text-2xs" />
    </div>
  );
}
