/**
 * Tipo de cambio inicial para capturas nuevas (embarques, proformas).
 *
 * Fuente de verdad: historial DOF (`tipos_cambio_dof`, alimentado por el cron
 * diario). Si el DOF del día aún no se publicó, devuelve el último publicado
 * indicando su fecha. Si el historial no está disponible, cae al servicio
 * remoto de tipos de cambio como sugerencia.
 *
 * v13.410.0
 */
import { useQuery } from "@tanstack/react-query";
import { fetchHistorialTcDof } from "@/features/catalogos/services/tipoCambioDof";
import { tcDofKeys } from "@/features/catalogos/hooks/useTipoCambioDof";
import { useExchangeRates } from "@/features/catalogos/hooks/useExchangeRates";

export interface TcInicial {
  usdMxn: number;
  eurMxn: number | null;
  /** Fecha de publicación DOF (ISO `YYYY-MM-DD`) cuando la fuente es DOF. */
  fecha: string | null;
  fuente: "DOF" | "remoto";
}

export function useTcInicial(): { data: TcInicial | null; isLoading: boolean } {
  const dof = useQuery({
    queryKey: tcDofKeys.historial(1),
    queryFn: () => fetchHistorialTcDof(1),
    staleTime: 15 * 60 * 1000,
    retry: 1,
  });
  const remoto = useExchangeRates();

  const fila = dof.data?.[0];
  if (fila && Number(fila.usd_mxn) > 0) {
    return {
      data: {
        usdMxn: Number(fila.usd_mxn),
        eurMxn: fila.eur_mxn == null ? null : Number(fila.eur_mxn),
        fecha: fila.fecha,
        fuente: "DOF",
      },
      isLoading: false,
    };
  }

  if (!dof.isLoading && remoto.data) {
    return {
      data: {
        usdMxn: remoto.data.usdMxn,
        eurMxn: remoto.data.eurMxn,
        fecha: null,
        fuente: "remoto",
      },
      isLoading: false,
    };
  }

  return { data: null, isLoading: dof.isLoading || remoto.isLoading };
}
