/**
 * Lista de notas de crédito asociadas a una factura, con acciones de
 * cambio de estado (Aprobar / Aplicar / Cancelar). Extraído de DialogNotaCredito
 * para respetar Power of 10 (componentes ≤200 líneas).
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { EstadoNotaCredito } from "@/hooks/facturacion";

const ESTADO_COLOR: Record<EstadoNotaCredito, string> = {
  Borrador: "bg-muted text-muted-foreground",
  Aprobada: "bg-warning/10 text-warning border-warning/20",
  Aplicada: "bg-success/10 text-success border-success/20",
  Cancelada: "bg-destructive/10 text-destructive border-destructive/20",
};

interface NotaItem {
  id: string;
  folio: string;
  estado: EstadoNotaCredito;
  motivo: string;
  fecha_emision: string;
  descripcion: string | null;
  monto: number | string;
  moneda: string;
}

interface Props {
  notas: NotaItem[];
  isLoading: boolean;
  canApprove: boolean;
  isPending: boolean;
  onCambiarEstado: (id: string, actual: EstadoNotaCredito, nuevo: EstadoNotaCredito) => void;
}

export function HistorialNotasCredito({ notas, isLoading, canApprove, isPending, onCambiarEstado }: Props) {
  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (notas.length === 0) return <p className="text-sm text-muted-foreground">No hay notas de crédito.</p>;

  return (
    <div className="space-y-1.5">
      {notas.map((n) => (
        <div key={n.id} className="flex items-center justify-between gap-2 rounded border p-2 text-sm">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs">{n.folio}</span>
              <Badge variant="outline" className={ESTADO_COLOR[n.estado]}>{n.estado}</Badge>
              <span className="text-xs text-muted-foreground">{n.motivo}</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {formatDate(n.fecha_emision)} · {n.descripcion || "—"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium tabular-nums">
              {formatCurrency(Number(n.monto), n.moneda)}
            </span>
            {canApprove && n.estado === "Borrador" && (
              <Button size="sm" variant="outline" disabled={isPending}
                onClick={() => onCambiarEstado(n.id, "Borrador", "Aprobada")}>
                Aprobar
              </Button>
            )}
            {canApprove && n.estado === "Aprobada" && (
              <Button size="sm" disabled={isPending}
                onClick={() => onCambiarEstado(n.id, "Aprobada", "Aplicada")}>
                Aplicar
              </Button>
            )}
            {(n.estado === "Borrador" || n.estado === "Aprobada") && (
              <Button size="sm" variant="ghost" disabled={isPending}
                onClick={() => onCambiarEstado(n.id, n.estado, "Cancelada")}>
                Cancelar
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
