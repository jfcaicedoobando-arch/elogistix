import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { emitirFacturapi, cancelarFacturapi, FacturapiError, type MotivoCancelacionSat, type CancelarFacturapiResult } from "@/features/facturacion/services/facturapi";
import { facturas as facturasKeys } from "@/features/facturacion/queryKeys";
import { useMutationWithFeedback } from "@/hooks/shared";
import { notifySuccess, notifyError, notifyInfo, notifyWarning } from "@/lib/ui/appFeedback";
import { queryKeys } from "@/lib/query";
import { invalidateHuecoFacturacion } from "@/features/facturacion/hooks/invalidateHuecoFacturacion";
import { invalidarTrasTimbrado } from "@/features/facturacion/hooks/invalidarTrasTimbrado";
import { getErrorMessage } from "@/lib/errors";

/**
 * Timbrado. Usa `useMutationWithFeedback` para el error (traducido por
 * `getErrorMessage`) e invalidaciones; el éxito se emite manualmente porque
 * la descripción es dinámica (serie/folio del CFDI recién emitido).
 */
export function useTimbrarFactura() {
  const qc = useQueryClient();
  return useMutationWithFeedback({
    mutationKey: queryKeys.facturacion.emitirFactura,
    mutationFn: (facturaId: string) => emitirFacturapi(facturaId),
    invalidate: facturasKeys.all,
    errorTitle: "No se pudo timbrar",
    errorMethod: "FEATURES_FACTURACION_HOOKS_USETIMBRARFACTURA_1",
    onSuccess: (res) => {
      notifySuccess(undefined, {
        title: "Factura timbrada correctamente",
        description: `Serie ${res.serie} · Folio ${res.folio}`,
      });
      invalidateHuecoFacturacion(qc);
      // M-1: bandejas, conteos y cartera CxC también cambian al timbrar.
      invalidarTrasTimbrado(qc);
    },
  });
}

type CancelarVars = {
  facturaId: string;
  motivo: MotivoCancelacionSat;
  sustituyeUuid?: string;
  sustituidaPorFacturaId?: string;
};

/**
 * Manejo compartido del resultado de `cancelarFacturapi`, reutilizado tanto
 * por el flujo normal como por el reintento tras un error transitorio del
 * SAT (v13.821.6). Evita que el reintento muestre "CFDI cancelado" cuando en
 * realidad la respuesta vino `pending`/`uncertain`.
 */
function manejarResultadoCancelacion(res: CancelarFacturapiResult, qc: QueryClient): void {
  if (res.uncertain) {
    // FacturApi tardó en confirmar, pero la solicitud quedó registrada como
    // `verifying`. Es éxito informativo: NO ofrecemos reintentar (reenviar la
    // cancelación con resultado incierto es inseguro); la acción permitida es
    // "Verificar estatus" en el detalle.
    notifyInfo(undefined, {
      title: "Cancelación enviada · verificando",
      description:
        (res.message
          ?? "La solicitud fue enviada, pero FacturApi tardó en confirmar. Estamos verificando el estado; no vuelvas a cancelarla.")
        + " Usa “Verificar estatus” en el detalle de la factura para consultar el resultado.",
      duration: 15000,
    });
  } else if (res.pending) {
    // Silencio positivo SAT (regla 2.7.1.34 RMF): el receptor tiene hasta
    // 72 h hábiles para aceptar/rechazar. NO decimos "cancelado".
    notifyInfo(undefined, {
      title: "Cancelación enviada al SAT",
      description: res.message
        ?? "El receptor tiene hasta 72 h para aceptar. El sistema reconciliará automáticamente.",
      duration: 12000,
    });
  } else {
    notifySuccess(undefined, { title: res.sustituida ? "CFDI sustituido" : "CFDI cancelado" });
  }

  qc.invalidateQueries({ queryKey: facturasKeys.all });
  invalidateHuecoFacturacion(qc);
  // M-1: una factura cancelada deja de ser cobrable en cartera/aging.
  invalidarTrasTimbrado(qc);
}

/**
 * Cancelación. No migrado a `useMutationWithFeedback` porque el éxito tiene
 * 3 ramas distintas (pending/sustituida/cancelado) y el error transitorio del
 * SAT dispara un toast ámbar con acción "Reintentar" que reinvoca el servicio
 * fuera del ciclo de React Query. Mantiene el manejo manual con `toast` de
 * sonner directo (`.warning`/`.info` no están en `notifyError`).
 */
export function useCancelarFactura() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: queryKeys.facturacion.cancelarFactura,
    mutationFn: (vars: CancelarVars) =>
      cancelarFacturapi(vars.facturaId, vars.motivo, vars.sustituyeUuid, vars.sustituidaPorFacturaId),
    onSuccess: (res) => manejarResultadoCancelacion(res, qc),
    onError: (err: Error, vars) => {
      // Error transitorio del SAT: pintar toast ámbar con acción "Reintentar"
      // en vez del toast rojo genérico. El modal queda abierto para que el
      // usuario reintente sin perder los datos ya seleccionados.
      if (err instanceof FacturapiError && err.transient) {
        notifyWarning(undefined, {
          title: "Servicio SAT no disponible",
          description: getErrorMessage(err),
          duration: 15000,
          method: "FEATURES_FACTURACION_HOOKS_USETIMBRARFACTURA_TRANSIENT",
          action: {
            label: "Reintentar",
            onClick: () => {
              // Reinvocamos la mutación desde el mismo hook (misma queryKey).
              cancelarFacturapi(
                vars.facturaId,
                vars.motivo,
                vars.sustituyeUuid,
                vars.sustituidaPorFacturaId,
              )
                .then((res) => manejarResultadoCancelacion(res, qc))
                .catch((e: Error) => {
                  notifyError(undefined, { title: "No se pudo cancelar la factura", description: getErrorMessage(e), error: e, method: "FEATURES_FACTURACION_HOOKS_USETIMBRARFACTURA_RETRY" });
                });
            },
          },
        });
        return;
      }
      notifyError(undefined, { title: "No se pudo cancelar la factura", description: getErrorMessage(err), error: err, method: "FEATURES_FACTURACION_HOOKS_USETIMBRARFACTURA_2" });
    },
  });
}
