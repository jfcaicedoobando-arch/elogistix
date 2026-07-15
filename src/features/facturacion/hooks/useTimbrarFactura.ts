import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { emitirFacturapi, cancelarFacturapi, FacturapiError, type MotivoCancelacionSat } from "@/features/facturacion/services/facturapi";
import { facturas as facturasKeys } from "@/features/facturacion/queryKeys";

import { notifyError } from "@/components/shared/utils/appFeedback";
import { queryKeys } from "@/lib/query";
export function useTimbrarFactura() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: queryKeys.facturacion.emitirFactura,
    mutationFn: (facturaId: string) => emitirFacturapi(facturaId),
    onSuccess: (res) => {
      toast.success(`Factura timbrada · UUID ${res.uuid.slice(0, 8)}…`);
      qc.invalidateQueries({ queryKey: facturasKeys.all });
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
      toast.success(res.sustituida ? "CFDI sustituido" : "CFDI cancelado");
      qc.invalidateQueries({ queryKey: facturasKeys.all });
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
                })
                .catch((e: Error) => {
                  toast.error(`No se pudo cancelar: ${e.message}`);
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
