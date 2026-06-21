import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { dialogSize, scrollableDialog } from "@/components/shared/utils/dialogTokens";
import { formatCurrency } from "@/lib/formatters";
import { usePagosFactura, useEliminarPagoFactura } from "@/features/facturacion/hooks";
import { useRegistrarActividad, useToast } from "@/hooks/shared";
import { notifySuccess, notifyError } from "@/components/shared/utils/appFeedback";
import { ERROR_CODES } from "@/lib/domain/errorCatalog";
import { DialogTimbrarRep } from "./DialogTimbrarRep";
import { DialogCancelarRep } from "./DialogCancelarRep";
import { PagoFacturaRow, type PagoRowData } from "./PagoFacturaRow";

interface Factura {
  id: string;
  numero: string;
  total: number;
  moneda: string;
  cliente_id?: string;
  uuid_fiscal?: string | null;
  metodo_pago?: string | null;
  rfc_cliente?: string | null;
  /** TC histórico de la factura (al momento de emisión). */
  tipo_cambio?: number;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  factura: Factura | null;
  canEdit: boolean;
}

// eslint-disable-next-line complexity
export function DialogHistorialPagos({ open, onOpenChange, factura, canEdit }: Props) {
  const { toast } = useToast();
  const { data: pagos = [], isLoading } = usePagosFactura(factura?.id);
  const eliminar = useEliminarPagoFactura();
  const registrarActividad = useRegistrarActividad();
  const [pagoAEliminar, setPagoAEliminar] = useState<string | null>(null);
  const [pagoATimbrarRep, setPagoATimbrarRep] = useState<string | null>(null);
  const [pagoACancelarRep, setPagoACancelarRep] = useState<string | null>(null);

  if (!factura) return null;

  const tcFactura = factura.tipo_cambio;
  const totalPagado = pagos.reduce((s, p) => s + Number(p.monto_aplicado_factura), 0);
  const esPPD = factura.metodo_pago === "PPD";

  const handleEliminar = async () => {
    if (!pagoAEliminar) return;
    try {
      await eliminar.mutateAsync({ id: pagoAEliminar, facturaId: factura.id });
      registrarActividad.mutate({
        accion: "eliminar", modulo: "facturas",
        entidad_id: factura.id,
        entidad_nombre: `Pago eliminado factura ${factura.numero}`,
      });
      notifySuccess(toast, { title: "Pago eliminado" });
      setPagoAEliminar(null);
    } catch {
      notifyError(toast, {
        title: "Error al eliminar pago",
        method: "ON_ERROR", errorCode: ERROR_CODES.VALIDATION_FAILED,
      });
    }
  };

  const pagoSel = pagoATimbrarRep ? pagos.find((p) => p.id === pagoATimbrarRep) : null;
  const facturaMin = {
    id: factura.id, numero: factura.numero,
    cliente_id: factura.cliente_id ?? "",
    uuid_fiscal: factura.uuid_fiscal ?? null,
    metodo_pago: factura.metodo_pago ?? null,
    rfc_cliente: factura.rfc_cliente ?? null,
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
              {esPPD && <> · <span className="text-muted-foreground">Factura PPD — requiere REP por cada pago</span></>}
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
                    {tcFactura !== undefined && (
                      <>
                        <th className="text-right py-2 px-2" title="Tipo de cambio del pago vs el TC de la factura">TC pago / fact.</th>
                        <th className="text-right py-2 px-2" title="Diferencia cambiaria registrada en MXN">Dif. cambiaria</th>
                      </>
                    )}
                    <th className="text-left py-2 px-2">Forma</th>
                    <th className="text-left py-2 px-2">Referencia</th>
                    <th className="text-left py-2 px-2">REP</th>
                    {canEdit && <th className="w-10"></th>}
                  </tr>
                </thead>
                <tbody>
                  {pagos.map((p) => (
                    <PagoFacturaRow
                      key={p.id}
                      // SAFE-CAST: usePagosFactura devuelve la fila tipada de Supabase; PagoRowData es un subset estrecho usado sólo para render.
                      pago={p as unknown as PagoRowData}
                      facturaMoneda={factura.moneda}
                      tcFactura={tcFactura}
                      canEdit={canEdit}
                      onTimbrarRep={setPagoATimbrarRep}
                      onCancelarRep={setPagoACancelarRep}
                      onEliminar={setPagoAEliminar}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <DialogTimbrarRep
        pago={pagoSel ? {
          id: pagoSel.id, monto: Number(pagoSel.monto), moneda: pagoSel.moneda,
          tipo_cambio: Number(pagoSel.tipo_cambio),
          forma_pago: pagoSel.forma_pago ?? "",
          fecha_pago: String(pagoSel.fecha_pago),
        } : null}
        factura={facturaMin}
        open={!!pagoATimbrarRep}
        onOpenChange={(o) => !o && setPagoATimbrarRep(null)}
      />

      <DialogCancelarRep
        pagoId={pagoACancelarRep}
        facturaId={factura.id}
        open={!!pagoACancelarRep}
        onOpenChange={(o) => !o && setPagoACancelarRep(null)}
      />

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
