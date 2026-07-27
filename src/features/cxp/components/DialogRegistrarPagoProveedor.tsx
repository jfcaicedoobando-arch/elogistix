/**
 * Registrar pago a proveedor.
 * Migrado a `FormDialogShell` (v13.120.0) — paridad visual con resto de modales CXP.
 */
import { notifySuccess } from "@/lib/ui/appFeedback";
import { Loader2, ArrowUpFromLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { useRegistrarPagoProveedor } from "@/features/cxp/hooks";
import type { FacturaCxP } from "@/features/cxp/services";
import { PagoFacturaHeaderInfo } from "./PagoProveedorBits";
import { usePagoProveedorForm } from "./usePagoProveedorForm";
import { PagoProveedorFormBody } from "./PagoProveedorFormBody";
import { notifyError } from "@/lib/ui/appFeedback";
import { traducirErrorPagoProveedor } from "@/features/cxp/services/pagosProveedorErrors";

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
    if (noAprobada) return notifyError(undefined, { title: "La factura debe estar aprobada antes de registrar pagos", method: "FEATURES_CXP_COMPONENTS_DIALOGREGISTRARPAGOPROVEEDOR_0" });
    if (f.montoNum <= 0) return notifyError(undefined, { title: "El monto debe ser mayor a 0", method: "FEATURES_CXP_COMPONENTS_DIALOGREGISTRARPAGOPROVEEDOR_1" });
    if (f.bloqueadoPorTc) return notifyError(undefined, { title: `Captura un tipo de cambio válido para pagar en MXN una factura ${factura.moneda}`, method: "FEATURES_CXP_COMPONENTS_DIALOGREGISTRARPAGOPROVEEDOR_4" });
    if (f.excede) return notifyError(undefined, { title: `El monto excede el saldo pendiente (${factura.moneda})`, method: "FEATURES_CXP_COMPONENTS_DIALOGREGISTRARPAGOPROVEEDOR_2" });
    try {
      await registrar.mutateAsync({
        proveedor_factura_id: factura.id,
        fecha_pago: f.fecha,
        monto: f.montoNum,
        moneda: f.moneda,
        // v13.308.8: si no hay TC válido (ej. pago MXN de factura MXN), enviamos
        // `null` — el CHECK `pagos_proveedor_tc_pos` sólo permite `NULL` o `> 0`.
        // Antes mandábamos `0` y disparaba `23514` en BD (Sentry JAVASCRIPT-REACT-1M).
        tipo_cambio_usd: Number(f.tc) > 0 ? Number(f.tc) : null,
        metodo_pago: f.metodo,
        referencia: f.referencia,
        notas: f.notas,
        diferencia_cambiaria_mxn:
          f.esUsdPagadoEnMxn && f.diffMxn !== "" ? Number(f.diffMxn) : null,
      });
      notifySuccess(undefined, { title: "Pago registrado" });
      onOpenChange(false);
    } catch (e) {
      notifyError(undefined, { title: traducirErrorPagoProveedor(e), error: e, method: "FEATURES_CXP_COMPONENTS_DIALOGREGISTRARPAGOPROVEEDOR_3" });
    }
  };

  const footer = (
    <>
      <Button variant="outline" onClick={() => onOpenChange(false)} disabled={registrar.isPending}>
        Cancelar
      </Button>
      <Button
        onClick={submit}
        disabled={registrar.isPending || f.excede || f.montoNum <= 0 || noAprobada || f.bloqueadoPorTc}
        title={noAprobada ? "Requiere aprobación" : f.bloqueadoPorTc ? "Captura el TC" : undefined}
      >
        {registrar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        {registrar.isPending ? "Guardando…" : "Registrar pago"}
      </Button>
    </>
  );

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={ArrowUpFromLine}
      title="Registrar pago a proveedor"
      description={factura ? `Aplica un pago contra el saldo pendiente de la factura seleccionada.` : undefined}
      size="lg"
      footer={footer}
    >
      {factura && <PagoFacturaHeaderInfo factura={factura} />}

      {noAprobada && (
        <div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          Esta factura no está aprobada. Solicita la aprobación en el detalle de la factura antes de registrar pagos.
        </div>
      )}

      <PagoProveedorFormBody factura={factura} {...f} />
    </FormDialogShell>
  );
}
