/**
 * Chip compacto de estado de aprobación (dot + label).
 * Extraído para reutilizarse en la Status Action Bar del detalle de factura.
 */
import { cn } from "@/lib/utils";
import type { EstadoAprobacion } from "@/features/cxp/services/aprobacionFactura";

interface Props {
  estado: EstadoAprobacion;
  cancelada?: boolean;
  className?: string;
}

const TONO: Record<
  string,
  { dot: string; text: string; label: string }
> = {
  pendiente: { dot: "bg-warning", text: "text-warning", label: "Pendiente" },
  aprobada: { dot: "bg-success", text: "text-success", label: "Aprobada" },
  rechazada: { dot: "bg-destructive", text: "text-destructive", label: "Rechazada" },
  cancelada: { dot: "bg-muted-foreground", text: "text-muted-foreground", label: "Cancelada" },
};

export function EstadoAprobacionDot({ estado, cancelada, className }: Props) {
  const key = cancelada ? "cancelada" : estado;
  const t = TONO[key] ?? TONO.pendiente;
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className={cn("h-2 w-2 rounded-full", t.dot)} aria-hidden />
      <span className={cn("text-xs font-semibold uppercase tracking-wide", t.text)}>
        {t.label}
      </span>
    </span>
  );
}
