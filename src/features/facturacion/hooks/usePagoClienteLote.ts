/**
 * Hook del cobro en lote de cliente (pago múltiple CxC).
 * Registra el lote de forma atómica y, cuando corresponde, timbra el REP de
 * cada pago aplicado a facturas PPD ya timbradas.
 * Ola 6 · RG5-5: un SOLO aviso al usuario (antes salían dos toasts a la vez,
 * uno del REP dentro de mutationFn y otro del cobro en onSuccess).
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { notifyError, notifySuccess, notifyWarning } from "@/lib/ui/appFeedback";
import {
  resumenRepLote,
  timbrarRepsSecuencial,
  type RepLoteResultado,
} from "@/features/facturacion/services/repLote";
import {
  registrarPagoClienteLote,
  traducirErrorCobroLote,
  type CobroLoteResultado,
  type RegistrarCobroLoteInput,
} from "@/features/facturacion/services/pagoClienteLote";

export interface CobroLoteVars extends RegistrarCobroLoteInput {
  /** Facturas PPD timbradas que requieren REP por cada pago del lote. */
  facturasConRep?: string[];
}

export function usePagoClienteLote() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (
      vars: CobroLoteVars,
    ): Promise<CobroLoteResultado & { rep: RepLoteResultado | null }> => {
      const res = await registrarPagoClienteLote(vars);
      const conRep = vars.facturasConRep ?? [];
      const pagoIds = res.pagos
        .filter((p) => conRep.includes(p.factura_id))
        .map((p) => p.pago_id);

      const rep = pagoIds.length > 0 ? await timbrarRepsSecuencial(pagoIds) : null;
      return { ...res, rep };
    },
    onSuccess: (res, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.facturas.all });
      qc.invalidateQueries({ queryKey: ["facturacion"] });
      qc.invalidateQueries({ queryKey: queryKeys.bandejas.all });
      qc.invalidateQueries({ queryKey: queryKeys.tesoreria.all });

      const aplicadas = vars.renglones.filter((r) => r.monto > 0).length;
      const base = `Cobro aplicado a ${aplicadas} facturas`;
      const rep = res.rep;

      if (rep && rep.fallos.length > 0) {
        notifyWarning(undefined, {
          title: `${base} — ${resumenRepLote(rep)}`,
          description: `Los pagos con error quedaron en la bandeja "REP pendientes" para reintentar. Primer error: ${rep.fallos[0].mensaje}`,
        });
        return;
      }

      notifySuccess(undefined, {
        title: rep ? `${base} — ${resumenRepLote(rep)}` : base,
      });
    },
    onError: (error: Error) => {
      notifyError(undefined, {
        title: traducirErrorCobroLote(error),
        error,
        method: "REGISTRAR_PAGO_CLIENTE_LOTE",
      });
    },
  });
}
