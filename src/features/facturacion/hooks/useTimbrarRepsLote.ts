/**
 * Hook de timbrado de REP en lote (bandeja "REP pendientes" y cobro en lote).
 * Timbra en secuencia y devuelve un resumen; los fallos no revierten nada.
 */
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { notifySuccess, notifyWarning } from "@/lib/ui/appFeedback";
import {
  resumenRepLote,
  timbrarRepsSecuencial,
  type RepLoteResultado,
} from "@/features/facturacion/services/repLote";

export function useTimbrarRepsLote() {
  const qc = useQueryClient();
  const [enProceso, setEnProceso] = useState(false);
  const [progreso, setProgreso] = useState<{ hechos: number; total: number } | null>(null);

  const timbrar = async (pagoIds: readonly string[]): Promise<RepLoteResultado> => {
    setEnProceso(true);
    setProgreso({ hechos: 0, total: pagoIds.length });
    try {
      const res = await timbrarRepsSecuencial(pagoIds, (hechos, total) =>
        setProgreso({ hechos, total }),
      );
      const titulo = resumenRepLote(res);
      if (res.fallos.length > 0) {
        notifyWarning(undefined, {
          title: titulo,
          description: `Los pagos con error siguen en la bandeja "REP pendientes" para reintentar. Primer error: ${res.fallos[0].mensaje}`,
        });
      } else {
        notifySuccess(undefined, { title: titulo });
      }
      return res;
    } finally {
      setEnProceso(false);
      setProgreso(null);
      qc.invalidateQueries({ queryKey: queryKeys.bandejas.all });
      qc.invalidateQueries({ queryKey: queryKeys.facturacion.repPendientes });
      qc.invalidateQueries({ queryKey: queryKeys.facturas.pagosAll });
      qc.invalidateQueries({ queryKey: ["facturacion"] });
    }
  };

  return { timbrar, enProceso, progreso };
}
