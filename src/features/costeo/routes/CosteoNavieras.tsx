/**
 * Página: Condiciones por naviera (carta garantía + tabulador de demoras).
 * v13.172.16: migrado de `<Table>` crudo a `DataTable` para homologar look & feel.
 */
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/shared/DataTable";
import {
  useCondicionesNaviera,
  useNavierasCatalogo,
} from "@/features/costeo/hooks/useNavieraCondiciones";
import { NavieraCondicionesDialog } from "@/features/costeo/components/NavieraCondicionesDialog";
import { combinarFilasNaviera, type FilaNaviera } from "@/features/costeo/types/filaNaviera";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { ListSkeleton } from "@/components/shared/states/ListSkeleton";
import { NavieraQuickCreate } from "@/features/costeo/components/NavieraQuickCreate";
import { ErrorState } from "@/components/shared/states/ErrorState";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { Ship, SearchX } from "lucide-react";
import { NavieraFiltrosBar } from "@/features/costeo/components/NavieraFiltrosBar";
import { filtrarNavieras, type EstadoNavieraFiltro } from "@/features/costeo/lib/navierasFiltro";
import { useCosteoNavierasColumns } from "@/features/costeo/hooks/useCosteoNavierasColumns";

export default function CosteoNavieras() {
  const { data: navieras = [], isLoading: loadingNav, isError: errorNav, refetch: refetchNav } = useNavierasCatalogo();
  const { data: condiciones = [], isLoading: loadingCond, isError: errorCond, refetch: refetchCond } = useCondicionesNaviera();
  const [seleccion, setSeleccion] = useState<FilaNaviera | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState<EstadoNavieraFiltro>("todos");

  const filas: FilaNaviera[] = useMemo(
    () => combinarFilasNaviera(navieras, condiciones),
    [navieras, condiciones],
  );

  const filasFiltradas = useMemo(
    () => filtrarNavieras(filas, busqueda, estado),
    [filas, busqueda, estado],
  );

  const hayFiltrosActivos = busqueda.trim() !== "" || estado !== "todos";
  const limpiarFiltros = () => {
    setBusqueda("");
    setEstado("todos");
  };

  const isLoading = loadingNav || loadingCond;
  const isError = errorNav || errorCond;
  const refetchAll = () => {
    void refetchNav();
    void refetchCond();
  };

  const columns = useCosteoNavierasColumns(setSeleccion);

  return (
    <PageContainer>
      <PageHeader
        title="Condiciones por naviera"
        description="Carta garantía, días libres y tabulador escalonado de demoras por tipo de contenedor."
        actions={<NavieraQuickCreate variante="boton" onCreada={() => undefined} />}
      />

      {isError ? (
        <ErrorState onRetry={refetchAll} />
      ) : isLoading ? (
        <ListSkeleton rows={6} variant="table" />
      ) : (
        <>
          <NavieraFiltrosBar
            busqueda={busqueda}
            onBusquedaChange={setBusqueda}
            estado={estado}
            onEstadoChange={setEstado}
          />
          <Card>
            <DataTable<FilaNaviera>
              columns={columns}
              data={filasFiltradas}
              rowKey={(f) => f.naviera_id}
              emptyState={
                filas.length === 0 && !hayFiltrosActivos ? (
                  <EmptyStateInline
                    icon={Ship}
                    message="Aún no hay navieras en el catálogo de tu organización."
                  >
                    <NavieraQuickCreate variante="boton" onCreada={() => undefined} />
                  </EmptyStateInline>
                ) : (
                  <EmptyStateInline
                    icon={SearchX}
                    message="Sin resultados para tu búsqueda o filtro."
                    action={{ label: "Limpiar filtros", onClick: limpiarFiltros }}
                  />
                )
              }
            />
          </Card>
        </>
      )}

      <NavieraCondicionesDialog
        seleccion={seleccion}
        onOpenChange={(o) => !o && setSeleccion(null)}
        onSaved={() => setSeleccion(null)}
      />
    </PageContainer>
  );
}
