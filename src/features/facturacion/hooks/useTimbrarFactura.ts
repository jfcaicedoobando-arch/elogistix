import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { emitirFacturapi, cancelarFacturapi, FacturapiError, type MotivoCancelacionSat } from "@/features/facturacion/services/facturapi";
import { facturas as facturasKeys } from "@/features/facturacion/queryKeys";

import { notifyError } from "@/lib/ui/appFeedback";
import { queryKeys } from "@/lib/query";
import { invalidateHuecoFacturacion } from "@/features/facturacion/hooks/invalidateHuecoFacturacion";
export function useTimbrarFactura() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: queryKeys.facturacion.emitirFactura,
    mutationFn: (facturaId: string) => emitirFacturapi(facturaId),
    onSuccess: (res) => {
      toast.success("Factura timbrada correctamente", {
        description: `Serie ${res.serie} · Folio ${res.folio}`,
        duration: 6000,
      });
      qc.invalidateQueries({ queryKey: facturasKeys.all });
      invalidateHuecoFacturacion(qc);
    },
    onError: (err: Error) => notifyError(toast, { title: `No se pudo timbrar: ${err.message}`, error: err, method: "FEATURES_FACTURACION_HOOKS_USETIMBRARFACTURA_1" }),
  });
}

type CancelarVars = {
  facturaId: string;
  motivo: MotivoCancelacionSat;
  sustituyeUuid?: string;
  sustituidaPorFacturaId?: string;
};

export function useCancelarFactura() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: queryKeys.facturacion.cancelarFactura,
    mutationFn: (vars: CancelarVars) =>
      cancelarFacturapi(vars.facturaId, vars.motivo, vars.sustituyeUuid, vars.sustituidaPorFacturaId),
    onSuccess: (res) => {
      if (res.pending) {
        // Silencio positivo SAT (regla 2.7.1.34 RMF): el receptor tiene hasta
        // 72 h hábiles para aceptar/rechazar. NO decimos "cancelado".
        toast.info("Cancelación enviada al SAT", {
          description: res.message
            ?? "El receptor tiene hasta 72 h para aceptar. El sistema reconciliará automáticamente.",
          duration: 12000,
        });
      } else {
        toast.success(res.sustituida ? "CFDI sustituido" : "CFDI cancelado");
      }
      qc.invalidateQueries({ queryKey: facturasKeys.all });
      invalidateHuecoFacturacion(qc);
    },
    onError: (err: Error, vars) => {
      // Error transitorio del SAT: pintar toast ámbar con acción "Reintentar"
      // en vez del toast rojo genérico. El modal queda abierto para que el
      // usuario reintente sin perder los datos ya seleccionados.
      if (err instanceof FacturapiError && err.transient) {
        toast.warning("Servicio SAT no disponible", {
          description: err.message,
          duration: 15000,
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
                .then(() => {
                  toast.success("CFDI cancelado");
                  qc.invalidateQueries({ queryKey: facturasKeys.all });
                  invalidateHuecoFacturacion(qc);
                })
                .catch((e: Error) => {
                  notifyError(toast, { title: `No se pudo cancelar: ${e.message}`, error: e, method: "FEATURES_FACTURACION_HOOKS_USETIMBRARFACTURA_RETRY" });
                });
            },
          },
        });
        return;
      }
      notifyError(toast, { title: `No se pudo cancelar: ${err.message}`, error: err, method: "FEATURES_FACTURACION_HOOKS_USETIMBRARFACTURA_2" });
    },
  });
}
