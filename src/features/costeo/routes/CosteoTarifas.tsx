/**
 * Página: matriz de tarifas marítimas (alta + lista filtrable) con la
 * bandeja de pricing como pestaña (`?tab=bandeja`).
 * v13.135.49: vista agrupada por ruta + toggle agrupada/tabla.
 * Oleada 4: migrado a PageContainer + PageHeader compartidos.
 */
import { useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus } from "lucide-react";
import { useCosteoAgentes } from "@/features/costeo/hooks/useCosteoAgentes";
import { useCosteoRutas } from "@/features/costeo/hooks/useCosteoRutas";
import { useTiposContenedor } from "@/features/catalogos/hooks";
import { TarifaForm } from "@/features/costeo/components/TarifaForm";
import { ConfirmDeleteAlert } from "@/features/costeo/components/ConfirmDeleteAlert";
import { CosteoTarifasFiltros } from "@/features/costeo/components/CosteoTarifasFiltros";
import { CosteoTarifasTable } from "@/features/costeo/components/CosteoTarifasTable";
import { TarifasKpis } from "@/features/costeo/components/TarifasKpis";
import { TarifasFilterChips } from "@/features/costeo/components/TarifasFilterChips";
import { TarifasEmptyState } from "@/features/costeo/components/TarifasEmptyState";
import { TarifasGroupedView } from "@/features/costeo/components/TarifasGroupedView";
import { useDocumentTitle } from "@/hooks/shared";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { BandejaPricingPanel } from "@/features/crm";
import {
  useCosteoTarifasPageState,
  DEFAULT_ESTADO,
} from "./useCosteoTarifasPageState";
import { ErrorState } from "@/components/shared/states/ErrorState";
import {
  destinoDe, etiquetaRutaCompleta, origenDe,
} from "@/features/costeo/utils/puertoLabel";

export default function CosteoTarifas() {
  // MR-UI-01: la pestaña del navegador debe reflejar la página activa.
  useDocumentTitle("Solicitudes de pricing");
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "bandeja" ? "bandeja" : "tarifas";
  const cambiarTab = (v: string) => {
    const n = new URLSearchParams(params);
    n.set("tab", v);
    setParams(n, { replace: true });
  };
  const s = useCosteoTarifasPageState();
  const { data: agentes = [] } = useCosteoAgentes();
  const { data: tipos = [] } = useTiposContenedor();

  const { data: rutas = [] } = useCosteoRutas();
  const rutaUrl = rutas.find((r) => r.id === s.rutaIdFromUrl);
  // P2-A2: el contexto de ruta se muestra aunque la ruta no tenga tarifas.
  const rutaLabel = s.tarifas[0]
    ? etiquetaRutaCompleta(origenDe(s.tarifas[0]), destinoDe(s.tarifas[0]))
    : rutaUrl ? `${rutaUrl.puerto_origen_nombre ?? "—"} → ${rutaUrl.puerto_destino_nombre ?? "—"}` : "ruta seleccionada";
  const showEmpty = !s.isLoading && !s.isError && s.tarifasFiltradas.length === 0;

  return (
    <PageContainer className="short:space-y-3">
      <Tabs value={tab} onValueChange={cambiarTab}>
        <TabsList>
          <TabsTrigger value="tarifas">Tarifas</TabsTrigger>
          <TabsTrigger value="bandeja">Bandeja de pricing</TabsTrigger>
        </TabsList>
        <TabsContent value="tarifas">
          <div className="space-y-4 pt-4">
            <PageHeader
              title="Solicitudes de pricing"
              description="Respuestas de pricing: tarifas por agente, naviera, ruta y contenedor. Moneda base: USD."
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

            {s.rutaIdFromUrl && (
              <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2">
                <p className="text-body">
                  Filtrando por ruta:{" "}
                  <span className="font-medium">
                    {rutaLabel}
                  </span>
                </p>
                <Button variant="ghost" size="sm" onClick={s.clearRutaUrl}>
                  Limpiar filtro
                </Button>
              </div>
            )}

            {/* CosteoTarifasFiltros conservado: interfaz compleja de 5 dimensiones */}
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
              counts={{ pendientes: s.pendientesCount, programadas: s.programadasCount }}
              onClearAll={s.clearAll}
              hasActiveFilters={s.hasActiveFilters}
              total={s.tarifasFiltradas.length}
              viewMode={s.viewMode}
              onViewModeChange={s.changeView}
            />

            <TarifasFilterChips
              estado={s.estado}
              aprobacion={s.aprobacion}
              agenteId={s.agenteId}
              tipoId={s.tipoId}
              busqueda={s.busqueda}
              soloPorVencer={s.soloPorVencer}
              onClearPorVencer={() => s.setSoloPorVencer(false)}
              agentes={agentes}
              tipos={tipos}
              onClearEstado={() => s.setEstado(DEFAULT_ESTADO)}
              onClearAprobacion={() => s.setAprobacion("todas")}
              onClearAgente={() => s.setAgenteId("todos")}
              onClearTipo={() => s.setTipoId("todos")}
              onClearBusqueda={() => s.setBusqueda("")}
              onClearAll={s.clearAll}
            />

            {s.isError ? (
              <ErrorState onRetry={() => void s.refetch()} />
            ) : showEmpty ? (
              <Card>
                <TarifasEmptyState
                  hasActiveFilters={s.hasActiveFilters}
                  rutaLabel={s.rutaIdFromUrl ? rutaLabel : undefined}
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

            <TarifaForm
              open={s.open}
              onOpenChange={s.setOpen}
              initial={s.initial}
              tarifaId={s.editId}
            />

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
        </TabsContent>
        <TabsContent value="bandeja">
          <div className="space-y-4 pt-4">
            <BandejaPricingPanel />
          </div>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
