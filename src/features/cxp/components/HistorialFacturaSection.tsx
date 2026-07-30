/**
 * Sección plegable con el historial unificado de una factura de proveedor:
 * captura, aprobación/rechazo, pagos, notas de crédito y eliminación.
 */
import {
  FilePlus2,
  Check,
  X,
  Banknote,
  FileMinus2,
  Trash2,
  Circle,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListSkeleton } from "@/components/shared/states/ListSkeleton";
import { DocumentoRailCard } from "@/components/shared/documento/DocumentoRailCard";
import { cn } from "@/lib/utils";

import { formatCurrency, formatDateTimeShort } from "@/lib/formatters";
import {
  useHistorialFactura,
  type EventoHistorialFactura,
} from "@/features/cxp/hooks/useHistorialFactura";

interface Props {
  facturaId: string;
}

function iconoTipo(tipo: string) {
  switch (tipo) {
    case "creada":
      return { Icon: FilePlus2, color: "text-primary", ring: "ring-primary/30" };
    case "aprobada":
      return { Icon: Check, color: "text-success", ring: "ring-success/30" };
    case "rechazada":
      return { Icon: X, color: "text-destructive", ring: "ring-destructive/30" };
    case "pago":
      return { Icon: Banknote, color: "text-success", ring: "ring-success/30" };
    case "nota_credito":
      return { Icon: FileMinus2, color: "text-warning", ring: "ring-warning/30" };
    case "eliminada":
      return { Icon: Trash2, color: "text-destructive", ring: "ring-destructive/30" };
    default:
      return { Icon: Circle, color: "text-muted-foreground", ring: "ring-border" };
  }
}

function FilaEvento({ ev }: { ev: EventoHistorialFactura }) {
  const { Icon, color, ring } = iconoTipo(ev.tipo);
  const motivo =
    ev.tipo === "rechazada"
      ? (ev.detalles?.motivo_rechazo as string | null | undefined)
      : null;
  return (
    <li className="relative pl-8">
      <span
        className={cn(
          "absolute left-0 top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-background ring-2",
          ring,
        )}
      >
        <Icon className={cn("h-3.5 w-3.5", color)} />
      </span>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-sm font-medium">{ev.descripcion}</span>
        {ev.monto != null && ev.moneda && (
          <span className="text-sm tabular-nums font-semibold">
            {formatCurrency(Number(ev.monto), ev.moneda)}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
        <span>{formatDateTimeShort(ev.ts)}</span>
        {ev.actor_email && (
          <>
            <span>·</span>
            <Badge variant="outline" className="font-normal text-2xs py-0 px-1.5 h-4">
              {ev.actor_email}
            </Badge>
          </>
        )}
      </div>
      {motivo && (
        <p className="text-xs italic text-muted-foreground mt-1">
          Motivo: {motivo}
        </p>
      )}
    </li>
  );
}

export function HistorialFacturaSection({ facturaId }: Props) {
  const {
    data: eventos = [],
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useHistorialFactura(facturaId, true);

  return (
    <DocumentoRailCard count={eventos.length}>
      {isLoading ? (
        <ListSkeleton rows={3} />
      ) : isError ? (
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <p className="text-sm font-medium text-destructive">
            No se pudo cargar el historial.
          </p>
          {error instanceof Error && (
            <p className="max-w-md truncate text-xs text-muted-foreground">
              {error.message}
            </p>
          )}
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      ) : eventos.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          Sin eventos registrados aún.
        </p>
      ) : (
        <>
          {isFetching && (
            <div className="mb-2 flex items-center gap-1.5 text-label italic text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Actualizando…</span>
            </div>
          )}
          <ol className="relative ml-3 space-y-4 border-l-2 border-border pl-1">
            {eventos.map((ev, i) => (
              <FilaEvento key={`${ev.tipo}-${ev.ts}-${i}`} ev={ev} />
            ))}
          </ol>
        </>
      )}
    </DocumentoRailCard>
  );
}

