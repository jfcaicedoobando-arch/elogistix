import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { emitirFacturapi, cancelarFacturapi, type MotivoCancelacionSat } from "@/features/facturacion/services/facturapi";
import { facturas as facturasKeys } from "@/features/facturacion/queryKeys";

import { notifyError } from "@/components/shared/utils/appFeedback";
export function useTimbrarFactura() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["fiscal", "emitir-factura"],
    mutationFn: (facturaId: string) => emitirFacturapi(facturaId),
    onSuccess: (res) => {
      toast.success(`Factura timbrada · UUID ${res.uuid.slice(0, 8)}…`);
      qc.invalidateQueries({ queryKey: facturasKeys.all });
    },
    onError: (err: Error) => notifyError(toast, { title: `No se pudo timbrar: ${err.message}`, error: err, method: "FEATURES_FACTURACION_HOOKS_USETIMBRARFACTURA_1" }),
  });
}

export function useCancelarFactura() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["fiscal", "cancelar-factura"],
    mutationFn: (vars: {
      facturaId: string;
      motivo: MotivoCancelacionSat;
      sustituyeUuid?: string;
      sustituidaPorFacturaId?: string;
    }) =>
      cancelarFacturapi(vars.facturaId, vars.motivo, vars.sustituyeUuid, vars.sustituidaPorFacturaId),
    onSuccess: (res) => {
      toast.success(res.sustituida ? "CFDI sustituido" : "CFDI cancelado");
      qc.invalidateQueries({ queryKey: facturasKeys.all });
    },
    onError: (err: Error) => notifyError(toast, { title: `No se pudo cancelar: ${err.message}`, error: err, method: "FEATURES_FACTURACION_HOOKS_USETIMBRARFACTURA_2" }),
  });
}

