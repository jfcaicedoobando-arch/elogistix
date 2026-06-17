import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { dialogSize, scrollableDialog } from "@/components/shared/utils/dialogTokens";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { usePagosFactura, useEliminarPagoFactura } from "@/features/facturacion/hooks";
import { useRegistrarActividad } from "@/hooks/shared";
import { useToast } from "@/hooks/shared";
import { notifySuccess, notifyError } from "@/components/shared/utils/appFeedback";
import { ERROR_CODES } from "@/lib/domain/errorCatalog";

interface Factura {
  id: string;
  numero: string;
  total: number;
  moneda: string;
  /** TC histórico de la factura (al momento de emisión). Sólo se usa para
   *  mostrar la conciliación cambiaria contra el TC de cada pago (I de la
   *  auditoría 13.49.0). */
  tipo_cambio?: number;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  factura: Factura | null;
  canEdit: boolean;
}

export function DialogHistorialPagos({ open, onOpenChange, factura, canEdit }: Props) {
  const { toast } = useToast();
  const { data: pagos = [], isLoading } = usePagosFactura(factura?.id);
  const eliminar = useEliminarPagoFactura();
  const registrarActividad = useRegistrarActividad();
  const [pagoAEliminar, setPagoAEliminar] = useState<string | null>(null);

  if (!factura) return null;

  const totalPagado = pagos.reduce((s, p) => s + Number(p.monto_aplicado_factura), 0);

  const handleEliminar = async () => {
    if (!pagoAEliminar) return;
    try {
      await eliminar.mutateAsync({ id: pagoAEliminar, facturaId: factura.id });
      registrarActividad.mutate({
        accion: "eliminar",
        modulo: "facturas",
        entidad_id: factura.id,
        entidad_nombre: `Pago eliminado factura ${factura.numero}`,
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
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={cn(dialogSize.lg, scrollableDialog)}>
          <DialogHeader>
            <DialogTitle>Historial de pagos — {factura.numero}</DialogTitle>
            <DialogDescription>
              Total facturado: <strong>{formatCurrency(factura.total, factura.moneda)}</strong> · Pagado:{" "}
              <strong>{formatCurrency(totalPagado, factura.moneda)}</strong>
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex justify-center p-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : pagos.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4 text-center">Sin pagos registrados.</p>
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
                    {canEdit && <th className="w-10"></th>}
                  </tr>
                </thead>
                <tbody>
                  {pagos.map((p) => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-2 px-2 whitespace-nowrap">{formatDate(p.fecha_pago)}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{formatCurrency(Number(p.monto), p.moneda)}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{formatCurrency(Number(p.monto_aplicado_factura), factura.moneda)}</td>
                      <td className="py-2 px-2">{p.forma_pago}</td>
                      <td className="py-2 px-2 max-w-[200px] truncate" title={p.referencia}>{p.referencia || "—"}</td>
                      {canEdit && (
                        <td className="py-2 px-2">
                          <Button
                            variant="ghost" size="icon"
                            onClick={(e) => { e.stopPropagation(); setPagoAEliminar(p.id); }}
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
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pagoAEliminar} onOpenChange={(o) => !o && setPagoAEliminar(null)}>
        <AlertDialogContent>
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
    </>
  );
}
