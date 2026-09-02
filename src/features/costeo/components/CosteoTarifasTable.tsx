/**
 * Tabla de tarifas marítimas (cuerpo de CosteoTarifas).
 * v13.172.17: migrado a `DataTable` (Fase 4 homologación); preserva
 * aprobación rápida inline y highlight de mejor precio.
 * v13.182.0: columnas extraídas a `_sections/tarifasColumns.tsx` (Wave 2).
 */
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/shared/DataTable";
import { DialogRechazarTarifa } from "./DialogRechazarTarifa";
import { useAprobacionTarifa } from "../hooks/useAprobacionTarifa";
import { buildTarifasColumns, type TarifaRow } from "./_sections/tarifasColumns";
import { todayLocalISO } from "@/lib/date/today";

interface Props {
  tarifas: TarifaRow[];
  isLoading: boolean;
  onEditar: (id: string) => void;
  onDuplicar: (id: string) => void;
  onEliminar: (id: string) => void;
}

export function CosteoTarifasTable({ tarifas, isLoading, onEditar, onDuplicar, onEliminar }: Props) {
  const { aprobar, rechazar, reactivar } = useAprobacionTarifa();
  const [rechazandoId, setRechazandoId] = useState<string | null>(null);

  const mejorPorGrupo = useMemo(() => {
    const hoy = todayLocalISO();
    const map = new Map<string, number>();
    for (const t of tarifas) {
      const ap = t.estado_aprobacion ?? "vigente";
      if (ap !== "vigente" || t.vigente_hasta < hoy || t.estado === "reemplazada") continue;
      const k = `${t.puerto_origen_nombre}→${t.puerto_destino_nombre}|${t.tipo_contenedor_nombre}`;
      const prev = map.get(k);
      if (prev == null || t.total_comparable < prev) map.set(k, t.total_comparable);
    }
    return map;
  }, [tarifas]);

  const columns = useMemo(
    () => buildTarifasColumns({
      mejorPorGrupo,
      aprobarPending: aprobar.isPending,
      reactivarPending: reactivar.isPending,
      onEditar, onDuplicar, onEliminar,
      onAprobar: (id) => aprobar.mutate({ id }),
      onRechazar: (id) => setRechazandoId(id),
      onReactivar: (id) => reactivar.mutate(id),
    }),
    [mejorPorGrupo, aprobar, reactivar, onEditar, onDuplicar, onEliminar],
  );

  return (
    <Card>
      <DataTable<TarifaRow>
        columns={columns}
        data={tarifas}
        rowKey={(t) => t.id}
        isLoading={isLoading}
        emptyMessage="Sin tarifas."
      />

      <DialogRechazarTarifa
        open={!!rechazandoId}
        onOpenChange={(o) => !o && setRechazandoId(null)}
        pending={rechazar.isPending}
        onConfirm={(motivo) => {
          if (!rechazandoId) return;
          rechazar.mutate(
            { id: rechazandoId, motivo },
            { onSuccess: () => setRechazandoId(null) },
          );
        }}
      />
    </Card>
  );
}
