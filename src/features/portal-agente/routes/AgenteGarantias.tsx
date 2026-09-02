/**
 * Carta garantía y tabulador de demoras del agente.
 *
 * Reutiliza el flujo de `CosteoNavieras` (NavieraCondicionForm + DemorasTarifaEditor).
 * v13.172.18: migrado a `DataTable` (Fase 5 homologación); onRowClick selecciona la fila
 * y abre el panel lateral con las condiciones.
 */
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Info, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  useCondicionesNaviera,
  useNavierasCatalogo,
} from "@/features/costeo/hooks/useNavieraCondiciones";
import { NavieraCondicionesDialog } from "@/features/costeo/components/NavieraCondicionesDialog";
import { combinarFilasNaviera, type FilaNaviera } from "@/features/costeo/types/filaNaviera";
import { useDocumentTitle } from "@/hooks/shared";
import { ErrorState } from "@/components/shared/states/ErrorState";
import { ResponsiveDataTable } from "@/components/shared/dataTable/ResponsiveDataTable";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { Ship, SearchX } from "lucide-react";
import { NavieraFiltrosBar } from "@/features/costeo/components/NavieraFiltrosBar";
import { filtrarNavieras, type EstadoNavieraFiltro } from "@/features/costeo/lib/navierasFiltro";
import {
  useAgenteGarantiasColumns,
  AgenteGarantiaMobileCard,
} from "@/features/portal-agente/components/useAgenteGarantiasColumns";

export default function AgenteGarantias() {
  useDocumentTitle('Carta Garantía y Demoras');
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

  const limpiarFiltros = () => {
    setBusqueda("");
    setEstado("todos");
  };

  const columns = useAgenteGarantiasColumns(setSeleccion);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<ShieldCheck className="h-6 w-6 text-accent" />}
        title="Carta garantía y demoras"
        description="Mantén actualizada tu carta garantía y el tabulador escalonado de demoras por naviera."
      />

      <Card className="p-3 flex items-start gap-2 bg-muted/40">
        <Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
        <p className="text-xs text-muted-foreground">
          <strong>¿Por qué importa?</strong> La carta garantía vigente permite que tus tarifas
          aparezcan como prioritarias en el comparador de cotizaciones. Si vence, el sistema
          marca tus tarifas con un aviso amarillo. El tabulador escalonado define cuánto cobra la
          naviera por cada día extra de demora (después de los días libres).
        </p>
      </Card>

      {errorNav || errorCond ? (
        <ErrorState
          onRetry={() => {
            void refetchNav();
            void refetchCond();
          }}
        />
      ) : (
        <>
          <NavieraFiltrosBar
            busqueda={busqueda}
            onBusquedaChange={setBusqueda}
            estado={estado}
            onEstadoChange={setEstado}
          />
          <ResponsiveDataTable<FilaNaviera>
            columns={columns}
            data={filasFiltradas}
            rowKey={(f) => f.naviera_id}
            isLoading={loadingNav || loadingCond}
            onRowClick={(f) => setSeleccion(f)}
            rowClassName={(f) => (seleccion?.naviera_id === f.naviera_id ? "bg-accent/40" : "")}
            mobileCard={(f) => <AgenteGarantiaMobileCard fila={f} onConfigurar={setSeleccion} />}
            emptyState={
              filas.length === 0 ? (
                <EmptyStateInline icon={Ship} message="Sin navieras configuradas." />
              ) : (
                <EmptyStateInline
                  icon={SearchX}
                  message="Sin resultados para tu búsqueda o filtro."
                  action={{ label: "Limpiar filtros", onClick: limpiarFiltros }}
                />
              )
            }
          />
        </>
      )}

      <NavieraCondicionesDialog
        seleccion={seleccion}
        onOpenChange={(o) => !o && setSeleccion(null)}
        onSaved={() => setSeleccion(null)}
      />
    </div>
  );
}
