/**
 * Página: matriz de tarifas marítimas (alta + lista filtrable).
 * v13.135.49: vista agrupada por ruta + toggle agrupada/tabla.
 */
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LayoutList, Plus, Rows3 } from "lucide-react";
import { safeLocalStorage, STORAGE_KEYS } from "@/lib/browserStorage";
import {
  useCosteoTarifas, useCosteoTarifaMutations,
} from "@/features/costeo/hooks/useCosteoTarifas";
import { useCosteoAgentes } from "@/features/costeo/hooks/useCosteoAgentes";
import { useTiposContenedor } from "@/features/catalogos/hooks";
import { TarifaForm } from "@/features/costeo/components/TarifaForm";
import { ConfirmDeleteAlert } from "@/features/costeo/components/ConfirmDeleteAlert";
import { CosteoTarifasFiltros } from "@/features/costeo/components/CosteoTarifasFiltros";
import { CosteoTarifasTable } from "@/features/costeo/components/CosteoTarifasTable";
import { TarifasKpis } from "@/features/costeo/components/TarifasKpis";
import { TarifasFilterChips } from "@/features/costeo/components/TarifasFilterChips";
import { TarifasEmptyState } from "@/features/costeo/components/TarifasEmptyState";
import { TarifasGroupedView } from "@/features/costeo/components/TarifasGroupedView";

type ViewMode = "agrupada" | "tabla";

function readViewMode(): ViewMode {
  return safeLocalStorage.getItem(STORAGE_KEYS.tarifasViewMode) === "tabla" ? "tabla" : "agrupada";
}
import type { TarifaInput } from "@/features/costeo/services/tarifas";
import {
  buildInitialFromTarifa, type EstadoFiltro, type AprobacionFiltro,
} from "./CosteoTarifas.helpers";
import { PageHeader } from "@/components/shared/PageHeader";

const DEFAULT_APROB: AprobacionFiltro = "borrador";
const DEFAULT_ESTADO: EstadoFiltro = "todas";

export default function CosteoTarifas() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rutaIdFromUrl = searchParams.get("ruta") ?? undefined;
  const [estado, setEstado] = useState<EstadoFiltro>(DEFAULT_ESTADO);
  const [aprobacion, setAprobacion] = useState<AprobacionFiltro>(DEFAULT_APROB);
  const [agenteId, setAgenteId] = useState<string>("todos");
  const [tipoId, setTipoId] = useState<string>("todos");
  const [busqueda, setBusqueda] = useState("");
  const [open, setOpen] = useState(false);
  const [initial, setInitial] = useState<Partial<TarifaInput> | undefined>();
  const [editId, setEditId] = useState<string | undefined>();
  const [aEliminar, setAEliminar] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(readViewMode);

  const changeView = (v: ViewMode) => {
    setViewMode(v);
    safeLocalStorage.setItem(STORAGE_KEYS.tarifasViewMode, v);
  };

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

  const tarifasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return tarifas.filter((t) => {
      if (aprobacion !== "todas" && (t.estado_aprobacion ?? "vigente") !== aprobacion) return false;
      if (!q) return true;
      const hay = `${t.puerto_origen_nombre} ${t.puerto_destino_nombre} ${t.agente_nombre} ${t.naviera_nombre}`.toLowerCase();
      return hay.includes(q);
    });
  }, [tarifas, aprobacion, busqueda]);

  const pendientesCount = useMemo(
    () => tarifas.filter((t) => (t.estado_aprobacion ?? "vigente") === "borrador").length,
    [tarifas],
  );

  const hasActiveFilters =
    aprobacion !== DEFAULT_APROB ||
    estado !== DEFAULT_ESTADO ||
    agenteId !== "todos" ||
    tipoId !== "todos" ||
    busqueda.trim() !== "";

  const clearAll = () => {
    setAprobacion(DEFAULT_APROB);
    setEstado(DEFAULT_ESTADO);
    setAgenteId("todos");
    setTipoId("todos");
    setBusqueda("");
  };

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
        title="Tarifas marítimas"
        description="Matriz CN → MX por agente, naviera, ruta y contenedor. Moneda base: USD."
        actions={
          <Button
            onClick={nuevo}
            title="Captura una vez y elige una o varias rutas para generarlas en lote."
          >
            <Plus className="size-4 mr-2" />Nueva(s) tarifa(s)
          </Button>
        }
      />

      <TarifasKpis
        tarifas={tarifas}
        onFilterPendientes={() => setAprobacion("borrador")}
        onFilterPorVencer={() => { setAprobacion("vigente"); setEstado("vigente"); }}
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
        aprobacion={aprobacion}
        onAprobacionChange={setAprobacion}
        agenteId={agenteId}
        onAgenteChange={setAgenteId}
        tipoId={tipoId}
        onTipoChange={setTipoId}
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        agentes={agentes}
        tipos={tipos}
        pendientesCount={pendientesCount}
        onClearAll={clearAll}
        hasActiveFilters={hasActiveFilters}
      />

      <TarifasFilterChips
        estado={estado}
        aprobacion={aprobacion}
        agenteId={agenteId}
        tipoId={tipoId}
        busqueda={busqueda}
        agentes={agentes}
        tipos={tipos}
        onClearEstado={() => setEstado(DEFAULT_ESTADO)}
        onClearAprobacion={() => setAprobacion("todas")}
        onClearAgente={() => setAgenteId("todos")}
        onClearTipo={() => setTipoId("todos")}
        onClearBusqueda={() => setBusqueda("")}
        onClearAll={clearAll}
      />

      {!isLoading && tarifasFiltradas.length > 0 && (
        <div className="flex justify-end">
          <ToggleGroup
            type="single"
            size="sm"
            value={viewMode}
            onValueChange={(v) => v && changeView(v as ViewMode)}
            aria-label="Modo de vista"
          >
            <ToggleGroupItem value="agrupada" aria-label="Vista agrupada por ruta">
              <Rows3 className="size-4 mr-1" />Agrupada
            </ToggleGroupItem>
            <ToggleGroupItem value="tabla" aria-label="Vista tabla plana">
              <LayoutList className="size-4 mr-1" />Tabla
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      )}

      {!isLoading && tarifasFiltradas.length === 0 ? (
        <Card>
          <TarifasEmptyState
            hasActiveFilters={hasActiveFilters}
            onClearFilters={clearAll}
            onNueva={nuevo}
          />
        </Card>
      ) : viewMode === "agrupada" ? (
        <TarifasGroupedView
          tarifas={tarifasFiltradas}
          onEditar={editar}
          onDuplicar={duplicar}
          onEliminar={(id) => setAEliminar(id)}
        />
      ) : (
        <CosteoTarifasTable
          tarifas={tarifasFiltradas}
          isLoading={isLoading}
          onEditar={editar}
          onDuplicar={duplicar}
          onEliminar={(id) => setAEliminar(id)}
        />
      )}

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
