/**
 * Página: matriz de tarifas marítimas (alta + lista filtrable).
 * v13.135.49: vista agrupada por ruta + toggle agrupada/tabla.
 */
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LayoutList, Plus, Rows3 } from "lucide-react";
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
import { PageHeader } from "@/components/shared/PageHeader";
import { useCosteoTarifasPageState, DEFAULT_ESTADO, type ViewMode } from "./useCosteoTarifasPageState";

export default function CosteoTarifas() {
  const s = useCosteoTarifasPageState();
  const { data: agentes = [] } = useCosteoAgentes();
  const { data: tipos = [] } = useTiposContenedor();

  const showList = !s.isLoading && s.tarifasFiltradas.length > 0;
  const showEmpty = !s.isLoading && s.tarifasFiltradas.length === 0;

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Tarifas marítimas"
        description="Matriz CN → MX por agente, naviera, ruta y contenedor. Moneda base: USD."
        actions={
          <Button
            onClick={s.nuevo}
            title="Puedes capturar una tarifa o seleccionar varias rutas para crearlas en lote."
          >
            <Plus className="size-4 mr-2" />Nueva tarifa
          </Button>
        }
      />

      <TarifasKpis
        tarifas={s.tarifas}
        onFilterPendientes={s.onFilterPendientes}
        onFilterPorVencer={s.onFilterPorVencer}
        activeKpi={s.activeKpi}
      />

      {s.rutaIdFromUrl && s.tarifas[0] && (
        <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2">
          <p className="text-sm">
            Filtrando por ruta:{" "}
            <span className="font-medium">
              {s.tarifas[0].puerto_origen_nombre} → {s.tarifas[0].puerto_destino_nombre}
            </span>
          </p>
          <Button variant="ghost" size="sm" onClick={s.clearRutaUrl}>
            Limpiar filtro
          </Button>
        </div>
      )}

      <CosteoTarifasFiltros
        estado={s.estado}
        onEstadoChange={s.setEstado}
        aprobacion={s.aprobacion}
        onAprobacionChange={s.setAprobacion}
        agenteId={s.agenteId}
        onAgenteChange={s.setAgenteId}
        tipoId={s.tipoId}
        onTipoChange={s.setTipoId}
        busqueda={s.busqueda}
        onBusquedaChange={s.setBusqueda}
        agentes={agentes}
        tipos={tipos}
        pendientesCount={s.pendientesCount}
        onClearAll={s.clearAll}
        hasActiveFilters={s.hasActiveFilters}
      />

      <TarifasFilterChips
        estado={s.estado}
        aprobacion={s.aprobacion}
        agenteId={s.agenteId}
        tipoId={s.tipoId}
        busqueda={s.busqueda}
        agentes={agentes}
        tipos={tipos}
        onClearEstado={() => s.setEstado(DEFAULT_ESTADO)}
        onClearAprobacion={() => s.setAprobacion("todas")}
        onClearAgente={() => s.setAgenteId("todos")}
        onClearTipo={() => s.setTipoId("todos")}
        onClearBusqueda={() => s.setBusqueda("")}
        onClearAll={s.clearAll}
      />

      {showList && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground tabular-nums">
            {s.tarifasFiltradas.length} {s.tarifasFiltradas.length === 1 ? "tarifa" : "tarifas"}
          </span>
          <ToggleGroup
            type="single"
            value={s.viewMode}
            onValueChange={(v) => v && s.changeView(v as ViewMode)}
            aria-label="Modo de vista"
          >
            <ToggleGroupItem value="agrupada" aria-label="Vista agrupada por ruta" className="h-8 px-3 text-xs">
              <Rows3 className="size-4 mr-1" />Agrupada
            </ToggleGroupItem>
            <ToggleGroupItem value="tabla" aria-label="Vista tabla plana" className="h-8 px-3 text-xs">
              <LayoutList className="size-4 mr-1" />Tabla
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      )}

      {showEmpty ? (
        <Card>
          <TarifasEmptyState
            hasActiveFilters={s.hasActiveFilters}
            onClearFilters={s.clearAll}
            onNueva={s.nuevo}
          />
        </Card>
      ) : s.viewMode === "agrupada" ? (
        <TarifasGroupedView
          tarifas={s.tarifasFiltradas}
          onEditar={s.editar}
          onDuplicar={s.duplicar}
          onEliminar={(id) => s.setAEliminar(id)}
        />
      ) : (
        <CosteoTarifasTable
          tarifas={s.tarifasFiltradas}
          isLoading={s.isLoading}
          onEditar={s.editar}
          onDuplicar={s.duplicar}
          onEliminar={(id) => s.setAEliminar(id)}
        />
      )}

      <TarifaForm open={s.open} onOpenChange={s.setOpen} initial={s.initial} tarifaId={s.editId} />

      <ConfirmDeleteAlert
        open={!!s.aEliminar}
        onOpenChange={(o) => !o && s.setAEliminar(null)}
        title="¿Eliminar esta tarifa?"
        description="La tarifa se eliminará permanentemente."
        pending={s.eliminar.isPending}
        onConfirm={() => {
          if (s.aEliminar) {
            s.eliminar.mutate(s.aEliminar, { onSuccess: () => s.setAEliminar(null) });
          }
        }}
      />
    </div>
  );
}
