/**
 * Detalle de pagos de una factura de proveedor — versión reescrita.
 * - Dialog 3xl scrollable.
 * - Header con KPIs mini (Total, Pagado, Saldo, # pagos).
 * - Tabla zebra-striping.
 * - Eliminación de pago con doble confirmación (typable ELIMINAR).
 */
import { useState } from "react";
import { format } from "date-fns";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { dialogSize } from "@/components/shared/utils/dialogTokens";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import DoubleConfirmDeleteDialog from "@/components/shared/DoubleConfirmDeleteDialog";
import { usePagosProveedor, useEliminarPagoProveedor } from "@/hooks/cxp";
import { formatCurrency } from "@/lib/formatters";
import type { FacturaCxP } from "@/services/cxp";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  factura: FacturaCxP | null;
  canEdit: boolean;
}

function Kpi({ label, value, tone = "default" }: {
  label: string; value: string; tone?: "default" | "success" | "warn";
}) {
  const cls = tone === "success" ? "text-success" : tone === "warn" ? "text-warning" : "text-foreground";
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2 flex-1 min-w-[120px]">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("text-base font-semibold tabular-nums", cls)}>{value}</p>
    </div>
  );
}

export function DialogDetallePagosProveedor({ open, onOpenChange, factura, canEdit }: Props) {
  const { data: pagos = [], isLoading } = usePagosProveedor(factura?.id);
  const eliminar = useEliminarPagoProveedor(factura?.id ?? "");
  const [pagoAEliminar, setPagoAEliminar] = useState<string | null>(null);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={cn(dialogSize["3xl"], "max-h-[90vh] flex flex-col gap-0 p-0")}>
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle>Detalle de pagos</DialogTitle>
            <DialogDescription>
              {factura ? `${factura.folio_proveedor} — ${factura.proveedor_nombre}` : ""}
            </DialogDescription>
            {factura && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Kpi label="Total" value={formatCurrency(factura.total, factura.moneda)} />
                <Kpi label="Pagado" value={formatCurrency(factura.pagado, factura.moneda)} tone="success" />
                <Kpi
                  label="Saldo"
                  value={formatCurrency(factura.saldo, factura.moneda)}
                  tone={factura.saldo > 0 ? "warn" : "default"}
                />
                <Kpi label="Pagos" value={String(pagos.length)} />
              </div>
            )}
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            ) : pagos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">
                No hay pagos registrados para esta factura.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Fecha</th>
                      <th className="text-left px-3 py-2 font-medium">Método</th>
                      <th className="text-left px-3 py-2 font-medium">Referencia</th>
                      <th className="text-right px-3 py-2 font-medium">Monto</th>
                      <th className="text-right px-3 py-2 font-medium">TC</th>
                      <th className="text-right px-3 py-2 font-medium">Δ MXN</th>
                      <th className="w-12" />
                    </tr>
                  </thead>
                  <tbody>
                    {pagos.map((p, idx) => (
                      <tr
                        key={p.id}
                        className={cn(
                          "border-t border-border",
                          idx % 2 === 1 && "bg-muted/20",
                        )}
                      >
                        <td className="px-3 py-2 whitespace-nowrap">
                          {format(new Date(p.fecha_pago + "T00:00:00"), "dd/MM/yyyy")}
                        </td>
                        <td className="px-3 py-2">{p.metodo_pago}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {p.referencia || "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium">
                          {formatCurrency(Number(p.monto), p.moneda)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-xs">
                          {p.tipo_cambio_usd ? Number(p.tipo_cambio_usd).toFixed(4) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-xs">
                          {p.diferencia_cambiaria_mxn != null
                            ? formatCurrency(Number(p.diferencia_cambiaria_mxn), "MXN")
                            : "—"}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {canEdit && (
                            <Button
                              variant="ghost" size="icon"
                              onClick={() => setPagoAEliminar(p.id)}
                              title="Eliminar pago"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t flex justify-end bg-background">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <DoubleConfirmDeleteDialog
        open={!!pagoAEliminar}
        onOpenChange={(o) => !o && setPagoAEliminar(null)}
        entityName="el pago"
        description="El pago será eliminado y el saldo de la factura se recalculará."
        finalDescription="Esta acción no se puede deshacer fácilmente."
        isPending={eliminar.isPending}
        onConfirm={async () => {
          if (!pagoAEliminar) return;
          await eliminar.mutateAsync(pagoAEliminar);
          setPagoAEliminar(null);
        }}
      />
    </>
  );
}
