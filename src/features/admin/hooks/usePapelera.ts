/**
 * Hook controller para `pages/admin/Papelera.tsx`. Encapsula la query de
 * registros eliminados + mutations de restore/purge. Extraído en v12.95.10
 * (Auditoría Paso 3).
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/shared";
import { listTrash, restoreRecord, purgeRecord, type SoftTable, type TrashRow } from "@/features/admin/services";
import { queryKeys } from "@/lib/query";

import { notifyError } from "@/components/shared/utils/appFeedback";
export type { SoftTable, TrashRow };

export function usePapelera(enabled: boolean) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tabla, setTabla] = useState<SoftTable>("embarques");

  const query = useQuery({
    queryKey: queryKeys.papelera(tabla),
    queryFn: () => listTrash(tabla, 200, 0),
    enabled,
  });

  const restore = useMutation({
    mutationFn: (id: string) => restoreRecord(tabla, id),
    onSuccess: () => {
      toast({ title: "Registro restaurado" });
      qc.invalidateQueries({ queryKey: queryKeys.papelera(tabla) });
    },
    onError: (e: Error) =>
      notifyError(toast, { title: "Error al restaurar", description: e.message, error: e, method: "FEATURES_ADMIN_HOOKS_USEPAPELERA_1" }),
  });

  const purge = useMutation({
    mutationFn: (id: string) => purgeRecord(tabla, id),
    onSuccess: () => {
      toast({ title: "Registro eliminado definitivamente" });
      qc.invalidateQueries({ queryKey: queryKeys.papelera(tabla) });
    },
    onError: (e: Error) =>
      notifyError(toast, { title: "Error al purgar", description: e.message, error: e, method: "FEATURES_ADMIN_HOOKS_USEPAPELERA_2" }),
  });

  return {
    tabla,
    setTabla,
    rows: query.data ?? [],
    isLoading: query.isLoading,
    restore,
    purge,
  };
}
