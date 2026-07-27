/**
 * Hook controller para `pages/admin/Papelera.tsx`. Encapsula la query de
 * registros eliminados + mutations de restore/purge. v13.290.0 agrega
 * `counts` (totales por tabla) para mostrar badges en el selector.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/shared";
import {
  listTrash, listTrashCounts, restoreRecord, purgeRecord,
  type SoftTable, type TrashRow, type TrashCountRow,
} from "@/features/admin/services";
import { queryKeys } from "@/lib/query";

import { notifyError } from "@/lib/ui/appFeedback";
export type { SoftTable, TrashRow, TrashCountRow };

export function usePapelera(enabled: boolean) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tabla, setTabla] = useState<SoftTable>("embarques");

  const query = useQuery({
    queryKey: queryKeys.papelera(tabla),
    queryFn: () => listTrash(tabla, 200, 0),
    enabled,
  });

  const countsQuery = useQuery({
    queryKey: queryKeys.papelera.counts,
    queryFn: () => listTrashCounts(),
    enabled,
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: queryKeys.papelera(tabla) });
    qc.invalidateQueries({ queryKey: queryKeys.papelera.counts });
  };

  const restore = useMutation({
    mutationFn: (id: string) => restoreRecord(tabla, id),
    onSuccess: () => {
      toast({ title: "Registro restaurado" });
      invalidateAll();
    },
    onError: (e: Error) =>
      notifyError(undefined, { title: "Error al restaurar", description: e.message, error: e, method: "FEATURES_ADMIN_HOOKS_USEPAPELERA_1" }),
  });

  const purge = useMutation({
    mutationFn: (id: string) => purgeRecord(tabla, id),
    onSuccess: () => {
      toast({ title: "Registro eliminado definitivamente" });
      invalidateAll();
    },
    onError: (e: Error) =>
      notifyError(undefined, { title: "Error al purgar", description: e.message, error: e, method: "FEATURES_ADMIN_HOOKS_USEPAPELERA_2" }),
  });

  return {
    tabla,
    setTabla,
    rows: query.data ?? [],
    isLoading: query.isLoading,
    counts: countsQuery.data ?? [],
    restore,
    purge,
  };
}
