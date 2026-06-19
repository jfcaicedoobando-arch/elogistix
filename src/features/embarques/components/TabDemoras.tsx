/**
 * Tab Demoras — fechas reales por contenedor para el cálculo escalonado de demoras.
 *
 * v13.66.11: el RPC `calcular_demoras_embarque` ahora usa `fecha_descarga`,
 * `fecha_devolucion` y `dias_libres_override` de cada `embarque_contenedores`
 * (con fallback al timeline del embarque cuando están en NULL). Esta tab
 * permite capturar esos valores; un trigger AFTER UPDATE recalcula
 * automáticamente al guardar.
 */
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import EmptyState from "@/components/empty/EmptyState";
import { Clock, Save } from "lucide-react";
import { useContenedoresEmbarque } from "@/features/embarques/hooks";
import type { EmbarqueContenedor } from "@/features/embarques/types/contenedor";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import { notifyError } from "@/components/shared/utils/appFeedback";
interface Props {
  embarqueId: string;
  canEdit: boolean;
}

interface EditableRow extends EmbarqueContenedor {
  // SAFE-CAST: columnas nuevas (13.66.11) aún no regeneradas en supabase/types.ts.
  fecha_descarga: string | null;
  fecha_devolucion: string | null;
  dias_libres_override: number | null;
}

interface DraftPatch {
  fecha_descarga?: string | null;
  fecha_devolucion?: string | null;
  dias_libres_override?: number | null;
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
    mutationFn: async ({ id, patch }: { id: string; patch: DraftPatch }) => {
      const { error } = await supabase
        .from("embarque_contenedores")
        // SAFE-CAST: columnas nuevas (13.66.11) aún no regeneradas en supabase/types.ts.
        .update(patch as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      toast.success("Demoras del contenedor actualizadas");
      setDrafts((d) => {
        const next = { ...d };
        delete next[vars.id];
        return next;
      });
      qc.invalidateQueries({ queryKey: ["embarque_contenedores", embarqueId] });
      qc.invalidateQueries({ queryKey: ["conceptos_costo", embarqueId] });
      qc.invalidateQueries({ queryKey: ["conceptos_venta", embarqueId] });
    },
    onError: (err: Error) => notifyError(toast, { title: err.message, error: err, method: "FEATURES_EMBARQUES_COMPONENTS_TABDEMORAS_1" }),
  });

  const setDraft = (id: string, patch: DraftPatch) => {
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
  };

  const valorActual = <K extends keyof DraftPatch>(
    row: EditableRow,
    field: K,
  ): DraftPatch[K] => {
    const draft = drafts[row.id];
    if (draft && field in draft) return draft[field];
    return row[field] as DraftPatch[K];
  };

  const guardar = (id: string) => {
    const patch = drafts[id];
    if (!patch) return;
    updateMut.mutate({ id, patch });
  };

  const columns = useMemo<ColumnDef<EditableRow, unknown>[]>(
    () => defineColumns<EditableRow>([
      {
        id: "cont",
        header: "Contenedor",
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-mono text-sm">
              {row.original.numero_contenedor || `#${row.original.orden}`}
            </span>
            <span className="text-xs text-muted-foreground">{row.original.tipo_contenedor}</span>
          </div>
        ),
      },
      {
        id: "f_desc",
        header: "Fecha de descarga",
        cell: ({ row }) => (
          <Input
            type="date"
            disabled={!canEdit}
            className="h-8 w-[140px]"
            value={(valorActual(row.original, "fecha_descarga") as string | null) ?? ""}
            onChange={(e) => setDraft(row.original.id, { fecha_descarga: e.target.value || null })}
          />
        ),
      },
      {
        id: "f_dev",
        header: "Fecha de devolución",
        cell: ({ row }) => (
          <Input
            type="date"
            disabled={!canEdit}
            className="h-8 w-[140px]"
            value={(valorActual(row.original, "fecha_devolucion") as string | null) ?? ""}
            onChange={(e) => setDraft(row.original.id, { fecha_devolucion: e.target.value || null })}
          />
        ),
      },
      {
        id: "dias_libres",
        header: "Días libres (override)",
        meta: { align: "right" },
        cell: ({ row }) => (
          <Input
            type="number"
            min={0}
            disabled={!canEdit}
            placeholder="naviera"
            className="h-8 w-[110px] tabular-nums text-right"
            value={(valorActual(row.original, "dias_libres_override") as number | null) ?? ""}
            onChange={(e) => {
              const raw = e.target.value;
              setDraft(row.original.id, {
                dias_libres_override: raw === "" ? null : Number(raw),
              });
            }}
          />
        ),
      },
      {
        id: "save",
        header: "",
        cell: ({ row }) => {
          const hasDraft = !!drafts[row.original.id];
          return (
            <Button
              size="sm"
              variant={hasDraft ? "default" : "ghost"}
              disabled={!hasDraft || updateMut.isPending || !canEdit}
              onClick={() => guardar(row.original.id)}
            >
              <Save className="size-3 mr-1" />
              Guardar
            </Button>
          );
        },
      },
    ]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canEdit, drafts, updateMut.isPending],
  );

  if (isLoading) return <div className="text-sm text-muted-foreground p-6">Cargando contenedores…</div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Demoras por contenedor</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Captura la fecha real de descarga y devolución de cada contenedor para que el sistema
            calcule las demoras con el tabulador escalonado de la naviera. Si los campos quedan
            vacíos se usan las fechas del timeline del embarque. El override de días libres
            sobreescribe el default configurado en la naviera. Al guardar, los conceptos de
            demoras automáticos se recalculan.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={rows}
            rowKey={(r) => r.id}
            density="compact"
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
