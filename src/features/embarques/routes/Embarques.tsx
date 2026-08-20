import { useDeferredValue } from "react";
import { Plus } from "lucide-react";
import { useDocumentTitle } from "@/hooks/shared";
import { Card, CardContent } from "@/components/ui/card";
import { ResponsiveDataTable } from "@/components/shared/dataTable/ResponsiveDataTable";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { CargaGuard } from "@/components/shared/states/CargaGuard";

import EmbarquesFiltros from "@/features/embarques/components/EmbarquesFiltros";
import { EmbarquesAlertasPanel } from "@/features/embarques/components/EmbarquesAlertasPanel";
import { EmbarquesEmptyState } from "@/features/embarques/components/EmbarquesEmptyState";
import { EmbarquesSortIndicator } from "@/features/embarques/components/EmbarquesSortIndicator";
import { EmbarquesHeaderActions } from "@/features/embarques/components/EmbarquesHeaderActions";
import { useEmbarquesPageController } from "@/features/embarques/hooks";
import { EmbarqueMobileCard } from "@/features/embarques/components/EmbarqueMobileCard";
import { notifyInfo } from "@/lib/ui/appFeedback";
import { EmbarquesTablaVacia } from "@/features/embarques/components/EmbarquesTablaVacia";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";
import { FloatingActionButton } from "@/components/shared/FloatingActionButton";


function buildDescription(contenedoresCount: number, expedientesCount: number, estadoActivo: boolean): string {
  if (!estadoActivo) {
    // UIA-09: sin filtro de estado el contador viene del total server-side de
    // EMBARQUES (computeCounts → totalCountServer), no de contenedores; llamarlo
    // "contenedores" descuadraba contra el detalle del expediente.
    return `${contenedoresCount} ${contenedoresCount === 1 ? "embarque" : "embarques"}`;
  }
  const cont = `${contenedoresCount} ${contenedoresCount === 1 ? "contenedor" : "contenedores"}`;
  const exp = `${expedientesCount} ${expedientesCount === 1 ? "expediente" : "expedientes"}`;
  return `${cont} en ${exp}`;
}


export default function Embarques() {
  useDocumentTitle("Embarques");
  const {
    state, clientes, operadoresUnicos, columns, isLoading, isError, refetch, isEmptyState,
    exportarCsv, exportandoCsv,
    navigate, prefetchEmbarque,
  } = useEmbarquesPageController();
  // v13.303.26 — el CTA "Nuevo embarque" desaparece: los embarques sólo se crean
  // desde una cotización Aceptada (política tarifa-first, sin excepciones).
  const canCrear = false;



  const {
    search, filterModo, filterEstado, filterCliente, filterOperador, filterAlerta,
    fechaDesde, fechaHasta, page, pageSize,
    sortKey, sortDir, handleSortChange,
    setSearch, setFilterModo, setFilterEstado, setFilterCliente, setFilterOperador, setFilterAlerta,
    setFechaDesde, setFechaHasta, setPage, setPageSize, limpiarFiltros,
    filtered, expedientesCount, contenedoresCount, totalPages, totalCount, alertasResumen,
  } = state;


  const goNuevo = () => navigate("/embarques/nuevo");
  // UIA-16: el alta directa está bloqueada por la política tarifa-first. En vez
  // de esconder la puerta de entrada, explicamos el prerrequisito y llevamos a
  // Cotizaciones (navegación proactiva, no un error después del hecho).
  const goNuevoDesdeCotizacion = () => {
    notifyInfo(undefined, {
      title: "Los embarques se crean desde una cotización",
      description: "Abre la cotización aceptada del cliente y usa \"Crear embarque\" para generar el expediente.",
    });
    navigate("/cotizaciones");
  };
  const headerDescription = buildDescription(contenedoresCount, expedientesCount, filterEstado !== "todos");


  // Diferimos las filas visibles del listado para que al cambiar filtros/página
  // el re-render pesado de la tabla no bloquee inputs ni interacciones (React 18).
  const deferredFiltered = useDeferredValue(filtered);

  return (
    // pb-24 md:pb-0: evita que el FAB tape la última fila en mobile.
    <PageContainer width="wide" className="pb-24 md:pb-0">


      <PageHeader
        title="Embarques"
        description={headerDescription}
        actions={
          isEmptyState ? null : (
            <EmbarquesHeaderActions
              canEdit={canCrear}
              exportandoCsv={exportandoCsv}
              onExport={exportarCsv}
              onNuevo={goNuevo}
              onNuevoDesdeCotizacion={goNuevoDesdeCotizacion}
            />

          )
        }
      />

      <CargaGuard
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        errorTitle="No pudimos cargar los embarques"
        errorDescription="Revisa tu conexión e intenta de nuevo."
      >
        {isEmptyState ? (
          <EmbarquesEmptyState canEdit={canCrear} onCreate={goNuevo} />
        ) : (
          <>
          {alertasResumen ? (
            <EmbarquesAlertasPanel
              resumen={alertasResumen}
              activeAlerta={filterAlerta}
              onSelect={(a) => { setFilterAlerta(a); setPage(0); }}
            />
          ) : null}
          <Card>
            <CardContent className="p-4">
              <EmbarquesFiltros
                search={search}
                onSearchChange={setSearch}
                filterModo={filterModo}
                onFilterModoChange={setFilterModo}
                filterEstado={filterEstado}
                onFilterEstadoChange={setFilterEstado}
                filterCliente={filterCliente}
                onFilterClienteChange={setFilterCliente}
                filterOperador={filterOperador}
                onFilterOperadorChange={setFilterOperador}

                fechaDesde={fechaDesde}
                onFechaDesdeChange={setFechaDesde}
                fechaHasta={fechaHasta}
                onFechaHastaChange={setFechaHasta}
                clientes={clientes}
                operadores={operadoresUnicos}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <EmbarquesSortIndicator
                sortKey={sortKey}
                sortDir={sortDir}
                onClear={() => handleSortChange(null, "asc")}
              />
              <ResponsiveDataTable
                columns={columns}
                data={deferredFiltered}
                isLoading={isLoading}
                emptyState={<EmbarquesTablaVacia onLimpiar={limpiarFiltros} />}
                getRowHref={(e) => `/embarques/${e.id}`}
                onRowMouseEnter={(e) => prefetchEmbarque(e.id)}
                rowKey={(e) => e.id}
                rowClassName={() => "group"}
                sortMode="server"
                controlledSort={{ key: sortKey, dir: sortDir }}
                onSortChange={handleSortChange}
                density={TABLE_DENSITY.listado}
                className="pb-24 sm:pb-0"
                mobileCard={(e) => <EmbarqueMobileCard embarque={e} />}
                pagination={{
                  page,
                  totalPages,
                  onPageChange: setPage,
                  pageSize,
                  onPageSizeChange: (s: number) => { setPageSize(s); setPage(0); },
                  pageSizeOptions: [50, 100, 200, 500],
                  pageSizeLabels: { 500: "500" },
                  total: totalCount,
                }}
              />
            </CardContent>
          </Card>
          </>
        )}
      </CargaGuard>

      {/* UIA-16: en mobile el alta primaria vive en el FAB (el header oculta el botón <md). */}
      {!isEmptyState ? (
        <FloatingActionButton
          onClick={canCrear ? goNuevo : goNuevoDesdeCotizacion}
          icon={<Plus className="h-6 w-6" />}
          label="Nuevo embarque"
        />
      ) : null}
    </PageContainer>
  );
}
