import { TimbradoContratoError } from "../services/timbradoWire";
import type { TimbradoScope } from "./useTimbradoScope";
import { descripcionTimbradoExitoso } from "../utils/usoCfdiTimbrado";
import { CancelacionContratoError } from "../services/cancelacionErrorWire";
import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { emitirFacturapi, cancelarFacturapi, FacturapiError, type MotivoCancelacionSat, type CancelarFacturapiResult } from "@/features/facturacion/services/facturapi";
import { esPendiente } from "@/features/facturacion/services/timbradoPendiente";
import { facturas as facturasKeys } from "@/features/facturacion/queryKeys";
import { notifySuccess, notifyError, notifyInfo, notifyWarning } from "@/lib/ui/appFeedback";
import { queryKeys } from "@/lib/query";
import { invalidateHuecoFacturacion } from "@/features/facturacion/hooks/invalidateHuecoFacturacion";
import { invalidarTrasTimbrado } from "@/features/facturacion/hooks/invalidarTrasTimbrado";
import { getErrorMessage } from "@/lib/errors";

/**
 * Timbrado: feedback e invalidaciones se acotan a la confirmación original.
 * El resultado fiscal en vuelo no se cancela ni se convierte en un fallo local.
 */
export function useTimbrarFactura() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: queryKeys.facturacion.emitirFactura,
    mutationFn: (vars: string | { facturaId: string; facturaNumero?: string; scope: TimbradoScope }) => {
      if (typeof vars !== "string") vars.scope.authScope.assertCurrent();
      return emitirFacturapi(typeof vars === "string" ? vars : vars.facturaId);
    },
    onError: (error, vars) => {
      if (typeof vars !== "string" && !vars.scope.isAuthCurrent()) return;
      if (error instanceof TimbradoContratoError) {
        const facturaId = typeof vars === "string" ? vars : vars.facturaId;
        invalidarTrasTimbrado(qc, facturaId);
        notifyWarning(undefined, {
          title: `Timbrado sin confirmar · ${typeof vars === "string" ? vars : vars.facturaNumero ?? facturaId}`,
          description: error.message, error, context: { facturaId },
          method: "FACTURACION_TIMBRADO_RESULTADO_INCIERTO", duration: 15000,
        });
        return;
      }
      if (typeof vars !== "string" && !vars.scope.authScope.isCurrent()) return;
      notifyError(undefined, { title: "No se pudo timbrar", description: getErrorMessage(error),
        error, method: "FEATURES_FACTURACION_HOOKS_USETIMBRARFACTURA_1" });
    },
    onSuccess: (res, vars) => {
      // El resultado fiscal debe reconciliarse aunque se haya cerrado el diálogo.
      // Nunca invalidar cachés de otra sesión; nunca continuar la confirmación vieja.
      if (typeof vars !== "string" && !vars.scope.isAuthCurrent()) return;
      qc.invalidateQueries({ queryKey: facturasKeys.all });
      invalidateHuecoFacturacion(qc);
      invalidarTrasTimbrado(qc, typeof vars === "string" ? vars : vars.facturaId);
      const dialogCurrent = typeof vars === "string" || vars.scope.authScope.isCurrent();
      if (esPendiente(res)) {
        // 202: no hay UUID ni folio y la factura sigue "Por timbrar". Decir
        // "timbrada" haría creer que ya facturó e invitaría a duplicar el CFDI.
        notifyInfo(undefined, {
          title: dialogCurrent ? "Timbrado en proceso"
            : `Timbrado en proceso · ${typeof vars === "string" ? vars : vars.facturaNumero ?? vars.facturaId}`,
          description: dialogCurrent ? res.message
            : `${res.message} No vuelvas a timbrar esta factura; consulta su estado.`,
          duration: 15000,
        });
      } else if (dialogCurrent) {
        notifySuccess(undefined, {
          title: "Factura timbrada correctamente",
          description: descripcionTimbradoExitoso(res),
        });
      }
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
      if (err instanceof CancelacionContratoError) {
        invalidarTrasTimbrado(qc, vars.facturaId);
        notifyWarning(undefined, {
          title: "Cancelación sin confirmar",
          description: err.message,
          error: err,
          context: { facturaId: vars.facturaId },
          method: "CANCELACION_RESULTADO_INCIERTO",
        });
        return;
      }
      // Error transitorio del SAT: pintar toast ámbar con acción "Reintentar"
      // en vez del toast rojo genérico. El modal queda abierto para que el
      // usuario reintente sin perder los datos ya seleccionados.
      if (err instanceof FacturapiError && err.transient) {
        notifyWarning(undefined, {
          title: "Servicio SAT no disponible",
          description: getErrorMessage(err),
          duration: 15000,
          method: "FEATURES_FACTURACION_HOOKS_USETIMBRARFACTURA_TRANSIENT",
          error: err, context: { facturaId: vars.facturaId },
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
