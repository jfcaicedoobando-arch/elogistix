/**
 * Encapsula el flujo de "registrar pago + auto-REP" para facturas PPD timbradas.
 * Extraído de `DialogRegistrarPago` para mantener la complejidad ciclomática
 * del componente por debajo del límite del linter.
 */
import { useState } from "react";
import { validarTcMxn } from "@/lib/financial/tcBanda";
import { useQueryClient } from "@tanstack/react-query";
import { notifySuccess, notifyError, notifyWarning, notifyInfo } from "@/lib/ui/appFeedback";
import { ERROR_CODES } from "@/lib/domain/errorCatalog";
import { getErrorMessage } from "@/lib/errors";
import { emitirRep, esRepYaTimbrado } from "@/features/facturacion/services/repFacturapi";
import { invalidarTrasRep } from "./invalidarRep";
import { useRegistrarPagoFactura } from "@/features/facturacion/hooks";
import { useRegistrarActividad } from "@/hooks/shared";
import { formatCurrency } from "@/lib/formatters";

import type { Moneda } from "@/types/db";

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
  /** Cuenta donde entró el dinero; `null` = no registrar movimiento bancario. */
  cuentaBancariaId?: string | null;
  /** BL-14: idempotencia de submit (UNIQUE parcial en `pagos_factura`). */
  clientRequestId?: string | null;
  esPpdTimbrada: boolean;
}

export function useRegistrarPagoSubmit(onSuccess: () => void) {
  const qc = useQueryClient();
  const registrar = useRegistrarPagoFactura();
  const registrarActividad = useRegistrarActividad();
  const [timbrandoRep, setTimbrandoRep] = useState(false);

  const intentarTimbrarRep = async (pagoId: string, facturaId: string) => {
    setTimbrandoRep(true);
    try {
      await emitirRep(pagoId);
      notifySuccess(undefined, {
        title: "REP timbrado",
        description: "Se generó el Recibo Electrónico de Pago.",
      });
    } catch (err) {
      if (esRepYaTimbrado(err)) {
        notifyInfo(undefined, {
          title: "Este pago ya tenía su REP timbrado",
          description: "Se actualizó la pantalla con el folio real del REP.",
        });
      } else {
        notifyError(undefined, {
          title: "Pago registrado, pero el REP falló",
          description: `${getErrorMessage(err)}. Puedes reintentar desde el historial de pagos.`,
          method: "ON_ERROR",
          errorCode: ERROR_CODES.VALIDATION_FAILED,
        });
      }
    } finally {
      setTimbrandoRep(false);
      // v13.549.0: sin esto el historial de pagos quedaba con el estado previo
      // ("REP pendiente") y el botón "Timbrar REP" seguía visible.
      invalidarTrasRep(qc, facturaId);
    }
  };

  const submit = async (args: SubmitArgs) => {
    // FE-01: guarda de dominio (no sólo UI). El CHECK de BD exige
    // tipo_cambio > 0 y monto_aplicado_factura > 0; con misma moneda estos
    // valores siempre son > 0, así que este guard no afecta el flujo normal.
    if (!(args.tipoCambio > 0) || !(args.montoAplicado > 0)) {
      notifyError(undefined, {
        title: "No hay tipo de cambio disponible",
        description:
          "No se pudo obtener el tipo de cambio para convertir el pago a la moneda de la factura. Espera unos segundos y vuelve a intentar.",
        method: "ON_ERROR",
        errorCode: ERROR_CODES.VALIDATION_FAILED,
      });
      return;
    }
    // M-14 (re-fix v15): si el pago se convierte a otra moneda, el T/C debe
    // caer en la banda de plausibilidad (pesos por divisa, 5-40).
    const tcFueraDeBanda =
      args.tipoCambio !== 1 ? validarTcMxn(args.tipoCambio) : null;
    if (tcFueraDeBanda) {
      notifyError(undefined, {
        title: "Tipo de cambio no plausible",
        description: tcFueraDeBanda,
        method: "ON_ERROR",
        errorCode: ERROR_CODES.VALIDATION_FAILED,
      });
      return;
    }
    try {
      const { pagoId, movimientoBancario } = await registrar.mutateAsync({
        factura_id: args.facturaId,
        fecha_pago: args.fecha,
        monto: args.monto,
        moneda: args.moneda,
        tipo_cambio: args.tipoCambio,
        monto_aplicado_factura: args.montoAplicado,
        forma_pago: args.formaPago,
        referencia: args.referencia,
        notas: args.notas,
        cuenta_bancaria_id: args.cuentaBancariaId ?? null,
        client_request_id: args.clientRequestId ?? null,
      });
      registrarActividad.mutate({
        accion: "crear",
        modulo: "facturas",
        entidad_id: args.facturaId,
        entidad_nombre: `Pago ${formatCurrency(args.monto, args.moneda)} factura ${args.facturaNumero}`,
      });
      notifySuccess(undefined, { title: "Pago registrado" });
      // RG15: el pago quedó, pero el abono al banco no se generó (cuenta de
      // otra moneda sin TC oficial, o fallo de inserción). Antes pasaba
      // desapercibido y el saldo del banco nunca subía.
      if (movimientoBancario === "fallido") {
        notifyWarning(undefined, {
          title: "Pago registrado, pero no se generó el movimiento bancario",
          description:
            "La cuenta destino es de otra moneda y no hay tipo de cambio oficial, o el abono falló. Registra el movimiento manualmente en Tesorería.",
        });
      }
      if (args.esPpdTimbrada && pagoId) await intentarTimbrarRep(pagoId, args.facturaId);
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
