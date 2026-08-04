/**
 * Recuperación inline del error `LC_PROFORMA_TC_REQUERIDO` al generar una
 * proforma: permite capturar el tipo de cambio USD del embarque desde el
 * propio modal y reintentar la generación sin perder la selección.
 *
 * v13.409.0
 */
import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { actualizarTipoCambioUsdEmbarque } from "@/features/embarques/services";
import { fetchHistorialTcDof } from "@/features/catalogos/services/tipoCambioDof";
import { tcDofKeys } from "@/features/catalogos/hooks/useTipoCambioDof";
import { queryKeys } from "@/lib/query";
import { notifyError } from "@/lib/ui/appFeedback";

/** ¿El error indica que falta el tipo de cambio del embarque? */
export function esErrorTcRequerido(mensaje: string): boolean {
  const m = mensaje.toUpperCase();
  return m.includes("LC_PROFORMA_TC_REQUERIDO") || m.includes("LC_TC_REQUERIDO");
}

export function useProformaTcRecovery(embarqueId: string) {
  const qc = useQueryClient();
  const [tcRequerido, setTcRequerido] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const { data: tcSugerido } = useQuery({
    queryKey: tcDofKeys.historial(1),
    enabled: tcRequerido,
    staleTime: 15 * 60 * 1000,
    queryFn: () => fetchHistorialTcDof(1),
    select: (rows) => rows[0]?.usd_mxn ?? null,
  });

  const activar = useCallback(() => setTcRequerido(true), []);
  const limpiar = useCallback(() => setTcRequerido(false), []);

  /** Guarda el TC en el embarque. Devuelve `true` si se guardó correctamente. */
  const guardarTc = useCallback(
    async (tc: number): Promise<boolean> => {
      setGuardando(true);
      try {
        await actualizarTipoCambioUsdEmbarque(embarqueId, tc);
        await qc.invalidateQueries({ queryKey: queryKeys.embarques.detail(embarqueId) });
        await qc.invalidateQueries({ queryKey: queryKeys.embarques.all });
        setTcRequerido(false);
        return true;
      } catch (error) {
        notifyError(undefined, {
          title: "No se pudo guardar el tipo de cambio",
          error,
          method: "EMBARQUE_TC_USD",
        });
        return false;
      } finally {
        setGuardando(false);
      }
    },
    [embarqueId, qc],
  );

  return { tcRequerido, tcSugerido: tcSugerido ?? null, guardando, activar, limpiar, guardarTc };
}
