import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notifyError, notifySuccess } from "@/components/shared/utils/appFeedback";
import {
  aprobarFacturaProveedor,
  AprobacionFacturaError,
} from "@/features/cxp/services/aprobacionFactura";
import { queryKeys } from "@/lib/query";

interface Vars {
  id: string;
  aprobar: boolean;
  motivo?: string;
  /** Contexto opcional para enriquecer el toast (folio, proveedor). */
  folio?: string | null;
  proveedor?: string | null;
}

export function useAprobarFactura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, aprobar, motivo }: Vars) =>
      aprobarFacturaProveedor(id, aprobar, motivo),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.cxp.all });
      qc.invalidateQueries({ queryKey: queryKeys.cxp.pendientesAprobacionCount });
      qc.invalidateQueries({ queryKey: queryKeys.cxp.factura(vars.id) });

      const ctx = [vars.folio, vars.proveedor].filter(Boolean).join(" · ");
      notifySuccess(undefined, {
        title: vars.aprobar ? "Factura aprobada" : "Factura rechazada",
        description: ctx
          ? `${ctx} — ${vars.aprobar ? "quedó lista para programar pago." : "el proveedor será notificado."}`
          : vars.aprobar
            ? "La factura quedó lista para programar pago."
            : "El motivo se registró en la bitácora.",
      });
    },
    onError: (error: Error, vars) => {
      const isDomain = error instanceof AprobacionFacturaError;
      const code = isDomain ? (error as AprobacionFacturaError).code : "UNKNOWN";
      notifyError(undefined, {
        title: vars.aprobar
          ? "No se pudo aprobar la factura"
          : "No se pudo rechazar la factura",
        description: error.message,
        error,
        errorCode: code,
        method: "APROBAR_FACTURA_PROVEEDOR",
        context: { facturaId: vars.id, aprobar: vars.aprobar },
      });
    },
  });
}
