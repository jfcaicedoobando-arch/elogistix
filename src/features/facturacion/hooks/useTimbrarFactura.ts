import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { emitirFacturapi, cancelarFacturapi, type MotivoCancelacionSat } from "@/features/facturas/services/facturapi";
import { facturas as facturasKeys } from "@/features/facturas/queryKeys";

export function useTimbrarFactura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (facturaId: string) => emitirFacturapi(facturaId),
    onSuccess: (res) => {
      toast.success(`Factura timbrada · UUID ${res.uuid.slice(0, 8)}…`);
      qc.invalidateQueries({ queryKey: facturasKeys.all });
    },
    onError: (err: Error) => toast.error(`No se pudo timbrar: ${err.message}`),
  });
}

export function useCancelarFactura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { facturaId: string; motivo: MotivoCancelacionSat; sustituyeUuid?: string }) =>
      cancelarFacturapi(vars.facturaId, vars.motivo, vars.sustituyeUuid),
    onSuccess: () => {
      toast.success("CFDI cancelado");
      qc.invalidateQueries({ queryKey: facturasKeys.all });
    },
    onError: (err: Error) => toast.error(`No se pudo cancelar: ${err.message}`),
  });
}
