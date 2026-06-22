/**
 * Detalle de pagos de una factura de proveedor.
 * Diseño "Densa + tooltips":
 * - Header con folio en mono.
 * - 4 KPIs con tonos semánticos.
 * - Tabla con columnas TC Pago / Dif. Cambio aclaradas vía tooltip.
 * - Método + Referencia agrupados.
 * - Eliminación de pago con doble confirmación typable ELIMINAR.
 */
import { useState } from "react";
import { format } from "date-fns";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { dialogSize } from "@/components/shared/utils/dialogTokens";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import DoubleConfirmDeleteDialog from "@/components/shared/DoubleConfirmDeleteDialog";
import { usePagosProveedor, useEliminarPagoProveedor } from "@/features/cxp/hooks";
import { formatCurrency } from "@/lib/formatters";
import type { FacturaCxP } from "@/features/cxp/services";
import { Kpi, HeaderWithTooltip } from "./DialogDetallePagosProveedor.parts";
import { BotonesAprobacionFactura } from "./BotonesAprobacionFactura";
import { NotasCreditoSection } from "./NotasCreditoSection";
import { usePermissions } from "@/hooks/shared";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  factura: FacturaCxP | null;
  canEdit: boolean;
}

export function DialogDetallePagosProveedor({ open, onOpenChange, factura, canEdit }: Props) {
  const { data: pagos = [], isLoading } = usePagosProveedor(factura?.id);
  const eliminar = useEliminarPagoProveedor(factura?.id ?? "");
  const [pagoAEliminar, setPagoAEliminar] = useState<string | null>(null);
  const { canEditFinance, isAdmin } = usePermissions();
  const puedeAprobar = canEditFinance || isAdmin;

  return (
    <TooltipProvider delayDuration={150}>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={cn(dialogSize["3xl"], "max-h-[90vh] flex flex-col gap-0 p-0")}>
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle>Detalle de pagos</DialogTitle>
            <DialogDescription className="font-mono uppercase tracking-wider text-xs">
              {factura ? `${factura.folio_proveedor} — ${factura.proveedor_nombre}` : ""}
            </DialogDescription>
          </DialogHeader>

          {factura && (
            <>
              <div className="px-6 pt-4 pb-3 border-b">
                <BotonesAprobacionFactura
                  facturaId={factura.id}
                  estado={factura.estado_aprobacion}
                  motivoRechazo={factura.motivo_rechazo}
                  puedeAprobar={puedeAprobar}
                />
              </div>
              <div className="px-6 py-5 grid grid-cols-2 md:grid-cols-4 gap-3 border-b">
                <Kpi label="Total Factura" value={formatCurrency(factura.total, factura.moneda)} />
                <Kpi label="Total Pagado" value={formatCurrency(factura.pagado, factura.moneda)} tone="success" />
                <Kpi
                  label="Saldo Pendiente"
                  value={formatCurrency(factura.saldo, factura.moneda)}
                  tone={factura.saldo > 0 ? "warn" : "default"}
                />
                <Kpi label="# Pagos" value={String(pagos.length)} />
              </div>
            </>
          )}

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
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
                  <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="text-left px-4 py-3 font-bold">Fecha</th>
                      <th className="text-left px-4 py-3 font-bold">Método</th>
                      <th className="text-right px-4 py-3 font-bold">Monto</th>
                      <th className="text-right px-4 py-3 font-bold">
                        <HeaderWithTooltip
                          label="TC Pago"
                          hint="Tipo de cambio USD→MXN registrado al momento de aplicar el pago."
                        />
                      </th>
                      <th className="text-right px-4 py-3 font-bold">
                        <HeaderWithTooltip
                          label="Dif. Cambio"
                          hint="Diferencia cambiaria en MXN (ganancia o pérdida) entre la tasa de la factura y la tasa del pago."
                        />
                      </th>
                      <th className="w-12" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {pagos.map((p) => (
                      <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap text-foreground">
                          {format(new Date(p.fecha_pago + "T00:00:00"), "dd/MM/yyyy")}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground">{p.metodo_pago}</span>
                            {p.referencia && (
                              <span className="text-[11px] text-muted-foreground">
                                Ref: {p.referencia}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium text-foreground">
                          {formatCurrency(Number(p.monto), p.moneda)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-xs text-muted-foreground">
                          {p.tipo_cambio_usd ? Number(p.tipo_cambio_usd).toFixed(4) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-xs text-muted-foreground">
                          {p.diferencia_cambiaria_mxn != null
                            ? formatCurrency(Number(p.diferencia_cambiaria_mxn), "MXN")
                            : "—"}
                        </td>
                        <td className="px-2 py-3 text-right">
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setPagoAEliminar(p.id)}
                              title="Eliminar pago"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {factura && (
              <NotasCreditoSection
                facturaId={factura.id}
                monedaFactura={factura.moneda}
                saldoFactura={factura.saldo}
                canEdit={canEdit}
              />
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
    </TooltipProvider>
  );
}
