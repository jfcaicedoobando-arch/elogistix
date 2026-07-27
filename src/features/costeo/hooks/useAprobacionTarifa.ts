/**
 * Hook: mutaciones de aprobación/rechazo/reactivación de tarifas para operaciones.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { notifySuccess } from "@/lib/ui/appFeedback";
import { aprobarTarifa, rechazarTarifa, reactivarTarifa } from "@/features/costeo/services/aprobacion";
import { notifyError } from "@/lib/ui/appFeedback";

function describeError(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "object" && e && "message" in e) return String((e as { message: unknown }).message);
  return "Error desconocido";
}

export function useAprobacionTarifa() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: queryKeys.costeo.tarifas.all });
    qc.invalidateQueries({ queryKey: queryKeys.portalAgente.tarifas() });
  };

  const aprobar = useMutation({
    mutationFn: (id: string) => aprobarTarifa(id),
    onSuccess: () => { invalidate(); notifySuccess(undefined, { title: "Tarifa aprobada — ahora está vigente." }); },
    onError: (e: unknown) => notifyError(undefined, {
      title: `No se pudo aprobar: ${describeError(e)}`,
      error: e,
      method: "FEATURES_COSTEO_HOOKS_USEAPROBACIONTARIFA_1",
    }),
  });

  const rechazar = useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo: string }) => rechazarTarifa(id, motivo),
    onSuccess: () => { invalidate(); notifySuccess(undefined, { title: "Tarifa rechazada — el agente fue notificado." }); },
    onError: (e: unknown) => notifyError(undefined, {
      title: `No se pudo rechazar: ${describeError(e)}`,
      error: e,
      method: "FEATURES_COSTEO_HOOKS_USEAPROBACIONTARIFA_2",
    }),
  });

  const reactivar = useMutation({
    mutationFn: (id: string) => reactivarTarifa(id),
    onSuccess: () => { invalidate(); notifySuccess(undefined, { title: "Tarifa devuelta a borrador." }); },
    onError: (e: unknown) => notifyError(undefined, {
      title: `No se pudo reactivar: ${describeError(e)}`,
      error: e,
      method: "FEATURES_COSTEO_HOOKS_USEAPROBACIONTARIFA_3",
    }),
  });

  return { aprobar, rechazar, reactivar };
}
