/**
 * Registrar pago a proveedor.
 * Refactor v12.95.23: estado movido a `usePagoProveedorForm` y cuerpo del
 * formulario a `PagoProveedorFormBody`. Este archivo sólo orquesta.
 */
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { dialogSize } from "@/components/shared/utils/dialogTokens";
import { Button } from "@/components/ui/button";
import { useRegistrarPagoProveedor } from "@/features/cxp/hooks";
import type { FacturaCxP } from "@/features/cxp/services";
import { PagoFacturaHeaderInfo } from "./PagoProveedorBits";
import { usePagoProveedorForm } from "./usePagoProveedorForm";
import { PagoProveedorFormBody } from "./PagoProveedorFormBody";

import { notifyError } from "@/components/shared/utils/appFeedback";
interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  factura: FacturaCxP | null;
}

export function DialogRegistrarPagoProveedor({ open, onOpenChange, factura }: Props) {
  const registrar = useRegistrarPagoProveedor();
  const f = usePagoProveedorForm(factura, open);
  const noAprobada = !!factura && factura.estado_aprobacion !== "aprobada";

  const submit = async () => {
    if (!factura) return;
    if (noAprobada) return notifyError(toast, { title: "La factura debe estar aprobada antes de registrar pagos", method: "FEATURES_CXP_COMPONENTS_DIALOGREGISTRARPAGOPROVEEDOR_0" });
    if (f.montoNum <= 0) return notifyError(toast, { title: "El monto debe ser mayor a 0", method: "FEATURES_CXP_COMPONENTS_DIALOGREGISTRARPAGOPROVEEDOR_1" });
    if (f.excede) return notifyError(toast, { title: "El monto excede el saldo pendiente", method: "FEATURES_CXP_COMPONENTS_DIALOGREGISTRARPAGOPROVEEDOR_2" });
    try {
      await registrar.mutateAsync({
        proveedor_factura_id: factura.id,
        fecha_pago: f.fecha,
        monto: f.montoNum,
        moneda: f.moneda,
        tipo_cambio_usd: Number(f.tc) || 0,
        metodo_pago: f.metodo,
        referencia: f.referencia,
        notas: f.notas,
        diferencia_cambiaria_mxn:
          f.esUsdPagadoEnMxn && f.diffMxn !== "" ? Number(f.diffMxn) : null,
      });
      toast.success("Pago registrado");
      onOpenChange(false);
    } catch (e) {
      const err = e as { message?: string };
      notifyError(toast, { title: err.message ?? "Error al registrar pago", error: e, method: "FEATURES_CXP_COMPONENTS_DIALOGREGISTRARPAGOPROVEEDOR_3" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(dialogSize.lg, "max-h-[90vh] flex flex-col gap-0 p-0")}>
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>Registrar pago a proveedor</DialogTitle>
          <DialogDescription>
            {factura ? `Factura ${factura.folio_proveedor} — ${factura.proveedor_nombre}` : ""}
          </DialogDescription>
          {factura && <PagoFacturaHeaderInfo factura={factura} />}
        </DialogHeader>

        <PagoProveedorFormBody factura={factura} {...f} />

        <div className="px-6 py-4 border-t flex justify-end gap-2 bg-background">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={registrar.isPending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={registrar.isPending || f.excede || f.montoNum <= 0}>
            {registrar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {registrar.isPending ? "Guardando…" : "Registrar pago"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
