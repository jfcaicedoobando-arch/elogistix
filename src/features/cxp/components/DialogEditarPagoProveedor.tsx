/**
 * Editar un pago a proveedor ya registrado (v13.395.0).
 *
 * Reutiliza el mismo cuerpo de formulario y las mismas validaciones que
 * "Registrar pago": montos con 2 decimales, fecha no futura ni anterior a la
 * emisión, TC válido, coherencia cuenta/moneda y monto que no exceda el saldo
 * disponible (devolviendo al saldo el importe del pago que se edita).
 */
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/shared/Hint";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { useActualizarPagoProveedor } from "@/features/cxp/hooks";
import type { FacturaCxP } from "@/features/cxp/services";
import { PagoFacturaHeaderInfo } from "./PagoProveedorBits";
import { PagoProveedorFormBody } from "./PagoProveedorFormBody";
import {
  usePagoProveedorForm,
  type PagoEditable,
} from "@/features/cxp/hooks/usePagoProveedorForm";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  factura: FacturaCxP | null;
  pago: PagoEditable | null;
}

export function DialogEditarPagoProveedor({ open, onOpenChange, factura, pago }: Props) {
  const actualizar = useActualizarPagoProveedor(factura?.id ?? "");
  const f = usePagoProveedorForm(factura, open, pago);

  const submit = async () => {
    if (!factura || !pago) return;
    if (f.validacion.error) {
      notifyError(undefined, {
        title: f.validacion.error,
        method: "FEATURES_CXP_COMPONENTS_DIALOGEDITARPAGOPROVEEDOR_VALIDAR",
      });
      return;
    }
    try {
      await actualizar.mutateAsync({
        id: pago.id,
        proveedor_factura_id: factura.id,
        fecha_pago: f.fecha,
        monto: f.montoNum,
        moneda: f.moneda,
        tipo_cambio_usd: Number(f.tc) > 0 ? Number(f.tc) : null,
        metodo_pago: f.metodo,
        referencia: f.referencia,
        notas: f.notas,
        cuenta_bancaria_id: f.cuentaId || null,
        diferencia_cambiaria_mxn:
          f.esUsdPagadoEnMxn && f.diffMxn !== "" ? Number(f.diffMxn) : null,
        expectedUpdatedAt: pago.updated_at ?? null,
      });
      notifySuccess(undefined, { title: "Pago actualizado" });
      onOpenChange(false);
    } catch {
      // El toast de error lo emite la mutación (onError).
    }
  };

  const submitDisabled = actualizar.isPending || f.validacion.error !== null;

  const footer = (
    <>
      <Button variant="outline" onClick={() => onOpenChange(false)} disabled={actualizar.isPending}>
        Cancelar
      </Button>
      <Hint label={f.validacion.error ?? undefined}>
        <Button onClick={submit} disabled={submitDisabled} loading={actualizar.isPending}>
          {actualizar.isPending ? "Guardando…" : "Guardar cambios"}
        </Button>
      </Hint>
    </>
  );

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Pencil}
      title="Editar pago a proveedor"
      description="Ajusta el pago registrado. Se validan montos, fechas, tipo de cambio y saldo antes de guardar."
      size="2xl"
      footer={footer}
    >
      {factura && <PagoFacturaHeaderInfo factura={factura} />}
      <PagoProveedorFormBody factura={factura} {...f} />
    </FormDialogShell>
  );
}
