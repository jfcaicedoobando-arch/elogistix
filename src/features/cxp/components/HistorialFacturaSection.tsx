/**
 * Sección plegable con el historial unificado de una factura de proveedor:
 * captura, aprobación/rechazo, pagos, notas de crédito y eliminación.
 */
import { useState } from "react";
import {
  History,
  FilePlus2,
  Check,
  X,
  Banknote,
  FileMinus2,
  Trash2,
  Circle,
  ChevronDown,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
  const [open, setOpen] = useState(false);
  const {
    data: eventos = [],
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useHistorialFactura(facturaId, open);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-b">
      <CollapsibleTrigger className="flex w-full items-center justify-between px-6 py-3 hover:bg-muted/40 transition-colors">
        <div className="flex items-center gap-2 text-sm font-medium">
          <History className="h-4 w-4 text-muted-foreground" />
          <span>Historial</span>
          {eventos.length > 0 && (
            <Badge variant="secondary" className="font-normal">
              {eventos.length}
            </Badge>
          )}
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-6 pb-5">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <p className="text-sm text-destructive font-medium">
              No se pudo cargar el historial.
            </p>
            {error instanceof Error && (
              <p className="text-xs text-muted-foreground max-w-md truncate">
                {error.message}
              </p>
            )}
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Reintentar
            </Button>
          </div>
        ) : eventos.length === 0 && !isFetching ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Sin eventos registrados aún.
          </p>
        ) : (
          <>
            {isFetching && eventos.length > 0 && (
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground italic mb-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Actualizando…</span>
              </div>
            )}
            {eventos.length === 0 ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : (
              <ol className="relative border-l-2 border-border ml-3 space-y-4 pl-1 mt-2">
                {eventos.map((ev, i) => (
                  <FilaEvento key={`${ev.tipo}-${ev.ts}-${i}`} ev={ev} />
                ))}
              </ol>
            )}
          </>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
