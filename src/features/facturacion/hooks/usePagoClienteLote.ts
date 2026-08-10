/**
 * Hook del cobro en lote de cliente (pago múltiple CxC).
 * Registra el lote de forma atómica y, cuando corresponde, timbra el REP de
 * cada pago aplicado a facturas PPD ya timbradas.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { notifyError, notifySuccess, notifyWarning } from "@/lib/ui/appFeedback";
import { emitirRep } from "@/features/facturacion/services/repFacturapi";
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

async function timbrarReps(res: CobroLoteResultado, facturasConRep: string[]): Promise<number> {
  let fallidos = 0;
  for (const pago of res.pagos) {
    if (!facturasConRep.includes(pago.factura_id)) continue;
    try {
      await emitirRep(pago.pago_id);
    } catch {
      fallidos += 1;
    }
  }
  return fallidos;
}

export function usePagoClienteLote() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (vars: CobroLoteVars): Promise<CobroLoteResultado> => {
      const res = await registrarPagoClienteLote(vars);
      const conRep = vars.facturasConRep ?? [];
      if (conRep.length > 0) {
        const fallidos = await timbrarReps(res, conRep);
        if (fallidos > 0) {
          notifyWarning(undefined, {
            title: "Cobro registrado; algunos REP no se timbraron",
            description: `${fallidos} recibo(s) de pago quedaron pendientes. Puedes reintentar desde el historial de pagos.`,
          });
        }
      }
      return res;
    },
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.facturas.all });
      qc.invalidateQueries({ queryKey: ["facturacion"] });
      qc.invalidateQueries({ queryKey: queryKeys.bandejas.all });
      qc.invalidateQueries({ queryKey: queryKeys.tesoreria.all });
      notifySuccess(undefined, {
        title: `Cobro aplicado a ${vars.renglones.filter((r) => r.monto > 0).length} facturas`,
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
