/**
 * Controlador de la tab Demoras (M14 Ola 1, antes inline en
 * components/TabDemoras.tsx). Concentra drafts, mutación de guardado e
 * invalidaciones; el componente queda presentacional.
 */
import { useCallback, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useContenedoresEmbarque } from "@/features/embarques/hooks";
import { actualizarDemorasContenedor } from "@/features/embarques/services/contenedores";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { queryKeys } from "@/lib/query";
import type { DraftPatch, EditableRow } from "@/features/embarques/components/_sections/tabDemorasColumns";

export function useTabDemorasController(embarqueId: string) {
  const { data: contenedores = [], isLoading } = useContenedoresEmbarque(embarqueId);
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, DraftPatch>>({});

  const rows = useMemo<EditableRow[]>(
    // SAFE-CAST: `contenedores` viene de supabase/types con columnas nuevas (13.66.11) aún no regeneradas; shape compatible con EditableRow en runtime.
    () => contenedores as unknown as EditableRow[],
    [contenedores],
  );

  const updateMut = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: DraftPatch }) =>
      actualizarDemorasContenedor(id, patch),
    onSuccess: (_, vars) => {
      notifySuccess(undefined, { title: "Demoras del contenedor actualizadas" });
      setDrafts((d) => {
        const next = { ...d };
        delete next[vars.id];
        return next;
      });
      qc.invalidateQueries({ queryKey: queryKeys.embarques.contenedores(embarqueId) });
      qc.invalidateQueries({ queryKey: queryKeys.embarques.conceptosCosto(embarqueId) });
      qc.invalidateQueries({ queryKey: queryKeys.embarques.conceptosVenta(embarqueId) });
    },
    onError: (err: Error) => notifyError(undefined, {
      title: err.message, error: err,
      method: "FEATURES_EMBARQUES_COMPONENTS_TABDEMORAS_1",
    }),
  });

  const setDraft = useCallback((id: string, patch: DraftPatch) => {
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
  }, []);

  const valorActual = useCallback(<K extends keyof DraftPatch>(
    row: EditableRow,
    field: K,
  ): DraftPatch[K] => {
    const draft = drafts[row.id];
    if (draft && field in draft) return draft[field];
    return row[field] as DraftPatch[K];
  }, [drafts]);

  const guardar = useCallback((id: string) => {
    const patch = drafts[id];
    if (!patch) return;
    updateMut.mutate({ id, patch });
  }, [drafts, updateMut]);

  return {
    rows,
    isLoading,
    drafts,
    isPending: updateMut.isPending,
    setDraft,
    valorActual,
    guardar,
  };
}
