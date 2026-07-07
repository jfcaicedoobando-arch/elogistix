/**
 * FacturaPagosSection — historial de pagos con acciones admin
 * (registrar pago / eliminar pago). Reusa `usePagosFactura` y los hooks
 * de mutación ya existentes. El cálculo de saldo replica al del diálogo
 * de registrar pago: `total − Σ monto_aplicado_factura`.
 */
import { useState } from "react";
import { Loader2, Trash2, CheckCircle2, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListSkeleton } from "@/components/shared/states/ListSkeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { usePagosFactura, useEliminarPagoFactura } from "@/features/facturacion/hooks";
import { useRegistrarActividad, useToast } from "@/hooks/shared";
import { notifySuccess, notifyError } from "@/components/shared/utils/appFeedback";
import { ERROR_CODES } from "@/lib/domain/errorCatalog";
import { dialogSize } from "@/components/shared/utils/dialogTokens";
import { DialogPreviewCfdiPdf } from "@/features/facturacion/components/DialogPreviewCfdiPdf";
import { PagoRepCell } from "./PagoRepCell";

interface Props {
  facturaId: string;
  facturaNumero: string;
  totalFactura: number;
  moneda: string;
  canEdit: boolean;
  /** @deprecated Ahora el botón vive en `FacturaDetalleActionsBar`. */
  onRegistrarPago?: () => void;
}

export function FacturaPagosSection({
  facturaId,
  facturaNumero,
  totalFactura,
  moneda,
  canEdit,
}: Props) {
  const { toast } = useToast();
  const { data: pagos = [], isLoading } = usePagosFactura(facturaId);
  const eliminar = useEliminarPagoFactura();
  const registrarActividad = useRegistrarActividad();
  const [pagoAEliminar, setPagoAEliminar] = useState<string | null>(null);
  const [previewRep, setPreviewRep] = useState<{ id: string; label: string } | null>(null);

  const totalPagado = pagos.reduce((s, p) => s + Number(p.monto_aplicado_factura ?? 0), 0);
  const saldo = Math.max(0, totalFactura - totalPagado);
  const liquidada = saldo < 0.01 && pagos.length > 0;

  const handleEliminar = async () => {
    if (!pagoAEliminar) return;
    try {
      await eliminar.mutateAsync({ id: pagoAEliminar, facturaId });
      registrarActividad.mutate({
        accion: "eliminar",
        modulo: "facturas",
        entidad_id: facturaId,
        entidad_nombre: `Pago eliminado factura ${facturaNumero}`,
      });
      notifySuccess(toast, { title: "Pago eliminado" });
      setPagoAEliminar(null);
    } catch {
      notifyError(toast, {
        title: "Error al eliminar pago",
        method: "ON_ERROR",
        errorCode: ERROR_CODES.VALIDATION_FAILED,
      });
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">Historial de pagos</CardTitle>
            {pagos.length > 0 && (
              <Badge variant={liquidada ? "default" : "secondary"} className="gap-1">
                {liquidada ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                {liquidada ? "Liquidada" : "Saldo pendiente"}
              </Badge>
            )}
          </div>
          {/* El botón "Registrar pago" vive ahora en la barra superior de acciones
              del detalle (`FacturaDetalleActionsBar`) para mantener el patrón unificado. */}
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <ListSkeleton rows={3} />
          ) : pagos.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Aún no se han registrado pagos para esta factura.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b">
                  <tr>
                    <th className="text-left py-2 px-2">Fecha</th>
                    <th className="text-right py-2 px-2">Monto</th>
                    <th className="text-right py-2 px-2">Aplicado</th>
                    <th className="text-left py-2 px-2">Forma</th>
                    <th className="text-left py-2 px-2">Referencia</th>
                    <th className="text-left py-2 px-2">REP</th>
                    {canEdit && <th className="w-10"></th>}
                  </tr>
                </thead>
                <tbody>
                  {pagos.map((p) => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-2 px-2 whitespace-nowrap">{formatDate(p.fecha_pago)}</td>
                      <td className="py-2 px-2 text-right tabular-nums">
                        {formatCurrency(Number(p.monto), p.moneda)}
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums">
                        {formatCurrency(Number(p.monto_aplicado_factura), moneda)}
                      </td>
                      <td className="py-2 px-2">{p.forma_pago}</td>
                      <td className="py-2 px-2 max-w-[200px] truncate" title={p.referencia ?? ""}>
                        {p.referencia || "—"}
                      </td>
                      <td className="py-2 px-2">
                        <PagoRepCell
                          pagoId={p.id}
                          estadoRep={p.estado_rep}
                          serieRep={p.serie_rep ?? null}
                          folioRep={p.folio_rep ?? null}
                          onPreview={(id, label) => setPreviewRep({ id, label })}
                        />
                      </td>
                      {canEdit && (
                        <td className="py-2 px-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPagoAEliminar(p.id);
                            }}
                            aria-label="Eliminar pago"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="border-t pt-3 grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Pagado</p>
              <p className="font-semibold tabular-nums">{formatCurrency(totalPagado, moneda)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Saldo</p>
              <p className={`font-bold tabular-nums ${liquidada ? "text-success" : "text-accent"}`}>
                {formatCurrency(saldo, moneda)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!pagoAEliminar} onOpenChange={(o) => !o && setPagoAEliminar(null)}>
        <AlertDialogContent className={dialogSize.sm}>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar pago</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro? Esto recalculará el estado de la factura.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={eliminar.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={eliminar.isPending}
              onClick={(e) => { e.preventDefault(); handleEliminar(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {eliminar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DialogPreviewCfdiPdf
        open={!!previewRep}
        onOpenChange={(o) => !o && setPreviewRep(null)}
        pagoId={previewRep?.id}
        title={previewRep ? `Complemento de pago ${previewRep.label}` : "Complemento de pago"}
      />
    </>
  );
}
