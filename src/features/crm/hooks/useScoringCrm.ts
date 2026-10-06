import { crm } from "../queryKeys";
/** Hooks del puntaje A/B/C (Fase 6). Llave base ['crm','scoring']. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { fetchPuntajeDetalle, fetchPuntajes, type ObjetoPuntaje } from "@/features/crm/services/scoring/scoringCrm";
import {
  actualizarRegla, crearRegla, eliminarRegla, guardarCortes, listarCortes, listarReglas,
  type Cortes, type NuevaRegla, type ReglaScoring,
} from "@/features/crm/services/scoring/reglasScoringCrm";

export const SCORING_KEY = crm.scoring.all;

export function usePuntajeDetalle(objeto: ObjetoPuntaje, id: string) {
  return useQuery({
    queryKey: crm.scoring.detalle(objeto, id),
    queryFn: () => fetchPuntajeDetalle(objeto, id),
    enabled: !!id,
  });
}

export function usePuntajes(objeto: ObjetoPuntaje, ids: string[]) {
  return useQuery({
    queryKey: crm.scoring.lote(objeto, ids),
    queryFn: () => fetchPuntajes(objeto, ids),
    enabled: ids.length > 0,
  });
}

export function useReglasScoring(objeto: ObjetoPuntaje) {
  return useQuery({ queryKey: crm.scoring.reglas(objeto), queryFn: () => listarReglas(objeto) });
}

export function useCortesScoring() {
  return useQuery({ queryKey: crm.scoring.cortes, queryFn: listarCortes });
}

function useMutacion<V>(fn: (v: V) => Promise<void>, ok: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => { if (ok) notifySuccess(undefined, { title: ok }); void qc.invalidateQueries({ queryKey: SCORING_KEY }); },
    onError: (error: Error, variables) => notifyError(undefined, { title: "No se pudo guardar la regla de puntaje", description: error.message,
      error, method: "CRM_SCORING_MUTACION", context: { variables } }),
  });
}

export const useCrearRegla = () => useMutacion((r: NuevaRegla) => crearRegla(r), "Regla agregada");
export const useEliminarRegla = () => useMutacion((id: string) => eliminarRegla(id), "Regla eliminada");
export const useGuardarCortes = () => useMutacion((c: Cortes) => guardarCortes(c), "Cortes guardados");
export const useActualizarRegla = () =>
  useMutacion(
    ({ id, cambio }: { id: string; cambio: Partial<Pick<ReglaScoring, "puntos" | "min" | "max" | "activa">> }) =>
      actualizarRegla(id, cambio),
    "",
  );
