/**
 * TC DOF vigente en una fecha concreta (para pagos: el TC del día del pago).
 *
 * El DOF de un día pasado no cambia, así que la caché es larga. Si el día
 * consultado no tiene publicación (fin de semana/inhábil), el servicio
 * devuelve el último publicado antes de esa fecha con `exacto: false`.
 */
import { useQuery } from "@tanstack/react-query";
import {
  fetchTcDofPorFecha,
  type TcDofVigente,
} from "@/features/catalogos/services/tipoCambioDof";

export const tcDofPorFechaKey = (fecha: string) =>
  ["tipos_cambio_dof", "porFecha", fecha] as const;

export function useTcDofPorFecha(fecha: string | null, enabled = true) {
  return useQuery<TcDofVigente | null>({
    queryKey: tcDofPorFechaKey(fecha ?? ""),
    queryFn: () => fetchTcDofPorFecha(fecha as string),
    enabled: enabled && !!fecha,
    staleTime: 15 * 60 * 1000,
    retry: 1,
    // RFE-09 (Ola 11): degradación silenciosa, mismo criterio que UIA-08 en
    // useExchangeRates. Sin TC la UI ya avisa y bloquea (traspasos y lotes);
    // un fallo de este servicio de apoyo no debe disparar el toast global.
    meta: { silentError: true },
  });
}

export type { TcDofVigente };
