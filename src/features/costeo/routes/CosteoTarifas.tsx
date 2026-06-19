/**
 * Página: matriz de tarifas marítimas (alta + lista filtrable).
 * v13.68.1: dividida en sub-componentes para cumplir Power of 10 (≤200 líneas).
 */
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus } from "lucide-react";
import {
  useCosteoTarifas, useCosteoTarifaMutations,
} from "@/features/costeo/hooks/useCosteoTarifas";
import { useCosteoAgentes } from "@/features/costeo/hooks/useCosteoAgentes";
import { useTiposContenedor } from "@/features/catalogos/hooks";
import { TarifaForm } from "@/features/costeo/components/TarifaForm";
import { ConfirmDeleteAlert } from "@/features/costeo/components/ConfirmDeleteAlert";
import { CosteoTarifasFiltros } from "@/features/costeo/components/CosteoTarifasFiltros";
import { CosteoTarifasTable } from "@/features/costeo/components/CosteoTarifasTable";
import type { TarifaInput } from "@/features/costeo/services/tarifas";
import { buildInitialFromTarifa, type EstadoFiltro } from "./CosteoTarifas.helpers";
import { PageHeader } from "@/components/shared/PageHeader";

export default function CosteoTarifas() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rutaIdFromUrl = searchParams.get("ruta") ?? undefined;
  const [estado, setEstado] = useState<EstadoFiltro>("vigente");
  const [agenteId, setAgenteId] = useState<string>("todos");
  const [tipoId, setTipoId] = useState<string>("todos");
  const [open, setOpen] = useState(false);
  const [initial, setInitial] = useState<Partial<TarifaInput> | undefined>();
  const [editId, setEditId] = useState<string | undefined>();
  const [aEliminar, setAEliminar] = useState<string | null>(null);

  const { data: agentes = [] } = useCosteoAgentes();
  const { data: tipos = [] } = useTiposContenedor();
  const tarifaFilters = useMemo(
    () => ({
      estado,
      agenteId: agenteId === "todos" ? undefined : agenteId,
      tipoContenedorId: tipoId === "todos" ? undefined : tipoId,
      rutaId: rutaIdFromUrl,
    }),
    [estado, agenteId, tipoId, rutaIdFromUrl],
  );
  const { data: tarifas = [], isLoading } = useCosteoTarifas(tarifaFilters);
  const { eliminar } = useCosteoTarifaMutations();

  const duplicar = (id: string) => {
    const t = tarifas.find((x) => x.id === id);
    if (!t) return;
    setEditId(undefined);
    setInitial({
      ...buildInitialFromTarifa(t),
      vigente_desde: new Date().toISOString().slice(0, 10),
    });
    setOpen(true);
  };

  const editar = (id: string) => {
    const t = tarifas.find((x) => x.id === id);
    if (!t) return;
    setEditId(id);
    setInitial(buildInitialFromTarifa(t));
    setOpen(true);
  };

  const nuevo = () => { setEditId(undefined); setInitial(undefined); setOpen(true); };

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Tarifas marítimas (USD)"
        description="Matriz CN → MX por agente, naviera, ruta y tipo de contenedor. El total comparable suma flete + recargos."
        actions={<Button onClick={nuevo}><Plus className="size-4 mr-2" />Nueva tarifa</Button>}
      />

      {rutaIdFromUrl && tarifas[0] && (
        <Card className="p-3 flex items-center justify-between bg-muted/40">
          <p className="text-sm">
            Filtrando por ruta:{" "}
            <span className="font-medium">
              {tarifas[0].puerto_origen_nombre} → {tarifas[0].puerto_destino_nombre}
            </span>
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              next.delete("ruta");
              setSearchParams(next, { replace: true });
            }}
          >
            Limpiar filtro
          </Button>
        </Card>
      )}

      <CosteoTarifasFiltros
        estado={estado}
        onEstadoChange={setEstado}
        agenteId={agenteId}
        onAgenteChange={setAgenteId}
        tipoId={tipoId}
        onTipoChange={setTipoId}
        agentes={agentes}
        tipos={tipos}
      />

      <CosteoTarifasTable
        tarifas={tarifas}
        isLoading={isLoading}
        onEditar={editar}
        onDuplicar={duplicar}
        onEliminar={(id) => setAEliminar(id)}
      />

      <TarifaForm open={open} onOpenChange={setOpen} initial={initial} tarifaId={editId} />

      <ConfirmDeleteAlert
        open={!!aEliminar}
        onOpenChange={(o) => !o && setAEliminar(null)}
        title="¿Eliminar esta tarifa?"
        description="La tarifa se eliminará permanentemente."
        pending={eliminar.isPending}
        onConfirm={() => {
          if (aEliminar) {
            eliminar.mutate(aEliminar, { onSuccess: () => setAEliminar(null) });
          }
        }}
      />
    </div>
  );
}
