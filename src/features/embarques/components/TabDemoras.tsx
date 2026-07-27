/**
 * Tab Demoras — fechas reales por contenedor para el cálculo escalonado de demoras.
 *
 * v13.66.11: el RPC `calcular_demoras_embarque` ahora usa `fecha_descarga`,
 * `fecha_devolucion` y `dias_libres_override` de cada `embarque_contenedores`
 * (con fallback al timeline del embarque cuando están en NULL). Esta tab
 * permite capturar esos valores; un trigger AFTER UPDATE recalcula
 * automáticamente al guardar.
 */
import { useCallback, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/shared/DataTable";
import EmptyState from "@/components/empty/EmptyState";
import { Clock } from "lucide-react";
import { useContenedoresEmbarque } from "@/features/embarques/hooks";
import { actualizarDemorasContenedor } from "@/features/embarques/services/contenedores";
import { notifySuccess } from "@/lib/ui/appFeedback";
import { notifyError } from "@/lib/ui/appFeedback";
import { queryKeys } from "@/lib/query";
import {
  buildDemorasColumns,
  type DraftPatch,
  type EditableRow,
} from "./_sections/tabDemorasColumns";

interface Props {
  embarqueId: string;
  canEdit: boolean;
}

export function TabDemoras({ embarqueId, canEdit }: Props) {
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
      qc.invalidateQueries({ queryKey: queryKeys.embarques.contenedoresLegacy(embarqueId) });
      qc.invalidateQueries({ queryKey: queryKeys.embarques.conceptosCosto(embarqueId) });
      qc.invalidateQueries({ queryKey: queryKeys.embarques.conceptosVenta(embarqueId) });
    },
    onError: (err: Error) => notifyError(undefined, { title: err.message, error: err, method: "FEATURES_EMBARQUES_COMPONENTS_TABDEMORAS_1" }),
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

  const columns = useMemo(
    () => buildDemorasColumns({
      canEdit, drafts, isPending: updateMut.isPending, valorActual, setDraft, guardar,
    }),
    [canEdit, drafts, updateMut.isPending, valorActual, setDraft, guardar],
  );

  if (isLoading) return <div className="text-sm text-muted-foreground p-6">Cargando contenedores…</div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Demoras por contenedor</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Captura la fecha real de descarga y devolución de cada contenedor para calcular las
            demoras con el tabulador de la naviera. Si dejas un campo vacío, usamos las fechas del
            timeline del embarque. El campo "Días libres" solo sobreescribe el default de la naviera
            cuando lo capturas. Al guardar, recalculamos automáticamente los conceptos de demora.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={rows}
            rowKey={(r) => r.id}
            density="compact"
            tableClassName="w-full"
            emptyState={
              <div className="p-6">
                <EmptyState
                  icon={Clock}
                  title="Sin contenedores"
                  description="Agrega contenedores al embarque para capturar sus demoras."
                />
              </div>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
