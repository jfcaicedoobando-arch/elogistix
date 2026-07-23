/**
 * Hooks de revalidación de tarifa (Fase 1).
 *
 * - `useSolicitarReaprobacion`: mutation que marca la cotización como
 *   pendiente de re-aprobación y notifica al operador comercial.
 * - `useResolverReaprobacion`: mutation que ventas resuelve.
 * - `useCrearEmbarqueBorradorConDecision`: mutation que crea el embarque
 *   pasando la decisión tomada (refrescada / mantenida / reaprobada_ventas…).
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import {
  solicitarReaprobacionVentas,
  resolverReaprobacion,
  crearEmbarqueBorradorConDecision,
} from "@/features/cotizacion/services/revalidacion";
import type { DecisionTarifa } from "@/features/cotizacion/domain/revalidacionTarifa";


export function useSolicitarReaprobacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cotizacionId, delta }: { cotizacionId: string; delta: unknown }) =>
      solicitarReaprobacionVentas(cotizacionId, delta),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.cotizaciones.detail(vars.cotizacionId) });
      qc.invalidateQueries({ queryKey: queryKeys.cotizaciones.all });
      notifySuccess(undefined, { title: "Re-aprobación de tarifa solicitada" });
    },
    onError: (error: Error) => {
      notifyError(undefined, {
        title: `No se pudo solicitar re-aprobación: ${error.message}`,
        error,
        method: "REVALIDACION_SOLICITAR_REAPROBACION",
      });
    },
  });
}

export function useResolverReaprobacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      cotizacionId,
      decision,
    }: {
      cotizacionId: string;
      decision: "reaprobada" | "rechazada" | "recotizada";
    }) => resolverReaprobacion(cotizacionId, decision),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.cotizaciones.detail(vars.cotizacionId) });
      qc.invalidateQueries({ queryKey: queryKeys.cotizaciones.all });
      const titulo =
        vars.decision === "reaprobada"
          ? "Tarifa re-aprobada"
          : vars.decision === "recotizada"
            ? "Cotización re-cotizada con tarifa vigente"
            : "Re-aprobación rechazada";
      notifySuccess(undefined, { title: titulo });
    },
    onError: (error: Error) => {
      notifyError(undefined, {
        title: `Error al resolver re-aprobación: ${error.message}`,
        error,
        method: "REVALIDACION_RESOLVER_REAPROBACION",
      });
    },
  });
}

export function useCrearEmbarqueBorradorConDecision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      cotizacionId,
      decision,
      tarifaIdAplicada,
      delta,
    }: {
      cotizacionId: string;
      decision: DecisionTarifa;
      tarifaIdAplicada: string | null;
      delta: unknown;
    }) => crearEmbarqueBorradorConDecision(cotizacionId, decision, tarifaIdAplicada, delta),
    onSuccess: (_id, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.embarques.all });
      qc.invalidateQueries({ queryKey: queryKeys.cotizaciones.all });
      qc.invalidateQueries({ queryKey: queryKeys.cotizaciones.detail(vars.cotizacionId) });
      notifySuccess(undefined, { title: "Embarque borrador creado" });
    },
    onError: (error: Error) => {
      notifyError(undefined, {
        title: `Error al crear embarque: ${error.message}`,
        error,
        method: "REVALIDACION_CREAR_EMBARQUE",
      });
    },
  });
}
