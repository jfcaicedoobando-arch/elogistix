/**
 * Mutación: crear factura manual + (opcional) timbrar al instante.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notifySuccess } from "@/lib/ui/appFeedback";
import {
  crearFacturaManual,
  type CrearFacturaManualInput,
} from "@/features/facturacion/services/facturaManual";
import { emitirFacturapi } from "@/features/facturacion/services/facturapi";
import { facturas as facturasKeys, facturacion as facturacionKeys } from "@/features/facturacion/queryKeys";
import { notifyError } from "@/lib/ui/appFeedback";
import { queryKeys } from "@/lib/query";
import { invalidateProfitDependencies } from "@/features/profit/hooks/invalidateProfitDependencies";
import { invalidateHuecoFacturacion } from "@/features/facturacion/hooks/invalidateHuecoFacturacion";

export interface CrearFacturaManualVars {
  input: CrearFacturaManualInput;
  timbrarAlGuardar: boolean;
}

export function useCrearFacturaManual() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: queryKeys.facturacion.facturaManual,
    mutationFn: async (vars: CrearFacturaManualVars) => {
      const facturaId = await crearFacturaManual(vars.input);
      if (vars.timbrarAlGuardar) {
        const res = await emitirFacturapi(facturaId);
        return { facturaId, timbrada: true as const, uuid: res.uuid };
      }
      return { facturaId, timbrada: false as const };
    },
    onSuccess: (res) => {
      if (res.timbrada) {
        notifySuccess(undefined, { title: `Factura manual timbrada · UUID ${res.uuid.slice(0, 8)}…` });
      } else {
        notifySuccess(undefined, { title: "Factura manual guardada como borrador" });
      }
      qc.invalidateQueries({ queryKey: facturasKeys.all });
      // Q-15.4: la bandeja "Por timbrar" no escuchaba esta mutación y quedaba
      // desactualizada hasta recargar la página tras guardar un borrador.
      // Se invalida por prefijo porque las llaves llevan `organizationId`.
      qc.invalidateQueries({ queryKey: facturacionKeys.bandejaPrefix() });
      // Auditoría: la regla `ventas_sin_facturar` depende del estado de facturación
      // de los embarques. Al crear/timbrar una factura, forzamos refetch del reporte.
      qc.invalidateQueries({ queryKey: queryKeys.auditoria.embarques });
      invalidateHuecoFacturacion(qc);
      invalidateProfitDependencies(qc);
    },
    onError: (err: Error) =>
      notifyError(undefined, {
        title: `No se pudo crear la factura: ${err.message}`,
        error: err,
        method: "FEATURES_FACTURACION_HOOKS_USECREARFACTURAMANUAL_1",
      }),
  });
}
