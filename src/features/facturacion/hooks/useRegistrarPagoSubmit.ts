/**
 * Encapsula el flujo de "registrar pago + auto-REP" para facturas PPD timbradas.
 * Extraído de `DialogRegistrarPago` para mantener la complejidad ciclomática
 * del componente por debajo del límite del linter.
 */
import { useState } from "react";
import { notifySuccess, notifyError } from "@/lib/ui/appFeedback";
import { ERROR_CODES } from "@/lib/domain/errorCatalog";
import { getErrorMessage } from "@/lib/errors";
import { emitirRep } from "@/features/facturacion/services/repFacturapi";
import { useRegistrarPagoFactura } from "@/features/facturacion/hooks";
import { useRegistrarActividad } from "@/hooks/shared";
import { formatCurrency } from "@/lib/formatters";

type Moneda = "MXN" | "USD" | "EUR";

interface SubmitArgs {
  facturaId: string;
  facturaNumero: string;
  fecha: string;
  monto: number;
  moneda: Moneda;
  tipoCambio: number;
  montoAplicado: number;
  formaPago: string;
  referencia: string;
  notas: string;
  esPpdTimbrada: boolean;
}

export function useRegistrarPagoSubmit(onSuccess: () => void) {
  const registrar = useRegistrarPagoFactura();
  const registrarActividad = useRegistrarActividad();
  const [timbrandoRep, setTimbrandoRep] = useState(false);

  const intentarTimbrarRep = async (pagoId: string) => {
    setTimbrandoRep(true);
    try {
      await emitirRep(pagoId);
      notifySuccess(undefined, {
        title: "REP timbrado",
        description: "Se generó el Recibo Electrónico de Pago.",
      });
    } catch (err) {
      notifyError(undefined, {
        title: "Pago registrado, pero el REP falló",
        description: `${getErrorMessage(err)}. Puedes reintentar desde el historial de pagos.`,
        method: "ON_ERROR",
        errorCode: ERROR_CODES.VALIDATION_FAILED,
      });
    } finally {
      setTimbrandoRep(false);
    }
  };

  const submit = async (args: SubmitArgs) => {
    try {
      const pagoId = await registrar.mutateAsync({
        factura_id: args.facturaId,
        fecha_pago: args.fecha,
        monto: args.monto,
        moneda: args.moneda,
        tipo_cambio: args.tipoCambio,
        monto_aplicado_factura: args.montoAplicado,
        forma_pago: args.formaPago,
        referencia: args.referencia,
        notas: args.notas,
      });
      registrarActividad.mutate({
        accion: "crear",
        modulo: "facturas",
        entidad_id: args.facturaId,
        entidad_nombre: `Pago ${formatCurrency(args.monto, args.moneda)} factura ${args.facturaNumero}`,
      });
      notifySuccess(undefined, { title: "Pago registrado" });
      if (args.esPpdTimbrada && pagoId) await intentarTimbrarRep(pagoId);
      onSuccess();
    } catch (err) {
      notifyError(undefined, {
        title: "Error al registrar pago",
        description: getErrorMessage(err),
        method: "ON_ERROR",
        errorCode: ERROR_CODES.VALIDATION_FAILED,
      });
    }
  };

  return {
    submit,
    isPending: registrar.isPending,
    timbrandoRep,
  };
}
