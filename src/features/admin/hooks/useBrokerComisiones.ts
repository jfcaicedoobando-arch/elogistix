import { useQuery } from "@tanstack/react-query";
import { useOrgActiva } from "@/hooks/shared/useOrgActiva";
import { useMutationWithFeedback } from "@/hooks/shared";
import {
  liquidacionesPendientesBroker, liquidarBroker, pagarLiquidacionBroker, resumenComisionesBroker, setPorcentajesBroker,
} from "@/features/admin/services/brokers";

const KEY = ["admin", "brokers"] as const;

export function useResumenComisionesBroker() {
  const { organizationId } = useOrgActiva();
  return useQuery({ queryKey: [...KEY, "comisiones", organizationId], queryFn: resumenComisionesBroker, enabled: !!organizationId });
}

export function useLiquidacionesBroker() {
  const { organizationId } = useOrgActiva();
  return useQuery({
    queryKey: [...KEY, "liquidaciones", organizationId],
    queryFn: () => liquidacionesPendientesBroker(organizationId as string),
    enabled: !!organizationId,
  });
}

export const useSetPorcentajesBroker = () =>
  useMutationWithFeedback({
    mutationFn: (v: { id: string; broker: number; kam: number | null }) => setPorcentajesBroker(v.id, v.broker, v.kam),
    invalidate: [...KEY], successTitle: "Porcentajes actualizados",
    successDescription: "Aplican a cobros nuevos.", errorTitle: "No se pudieron guardar los porcentajes",
  });

export const useLiquidarBroker = () =>
  useMutationWithFeedback({
    mutationFn: (v: { brokerId: string; periodo: string }) => liquidarBroker(v.brokerId, v.periodo),
    invalidate: [...KEY], successTitle: "Liquidación generada", errorTitle: "No se pudo liquidar",
  });

export const usePagarLiquidacionBroker = () =>
  useMutationWithFeedback({
    mutationFn: (v: { id: string; fecha: string; referencia: string }) => pagarLiquidacionBroker(v.id, v.fecha, v.referencia),
    invalidate: [...KEY], successTitle: "Liquidación marcada como pagada", errorTitle: "No se pudo registrar el pago",
  });
