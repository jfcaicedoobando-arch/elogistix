/**
 * /crm/actividades — Registro de actividades CRM con URL sync (Ola 2).
 *
 * Migrado a `useServerPagedList` + `<UnifiedFiltersBar />`:
 *   - Todo el estado (búsqueda, tipo, estado, responsable, orden, paginación)
 *     vive en la URL vía nuqs (`?q=&tipo=&estado=&resp=&sort=&dir=&page=&ps=`).
 *   - Soporta el shortcut `?filtro=vencidas`, que se resuelve SERVER-SIDE
 *     (pendientes + mías + `fecha_programada < now`), así que el contador y la
 *     paginación corresponden al conjunto vencido.
 */
import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CrmSubheader } from "@/features/crm/components/CrmSubheader";
import { ResponsiveDataTable } from "@/components/shared/dataTable/ResponsiveDataTable";
import { UnifiedFiltersBar } from "@/components/shared/filters/UnifiedFiltersBar";
import { useServerPagedList } from "@/hooks/shared/useServerPagedList";
import { usePermissions, useDocumentTitle } from "@/hooks/shared";
import { useAuth } from "@/lib/contexts/AuthContext";
import {
  ACTIVIDAD_SORTABLE_KEYS,
  type ActividadSortKey,
} from "@/features/crm/services/actividades";
import { listActividadesAgenda } from "@/features/crm/services/actividadEntidades";
import {
  type CrmActividadRow, type CrmActividadTipo,
} from "@/features/crm/hooks";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { queryKeys } from "@/lib/query";
import { pluralizar } from "@/lib/format/pluralizar";
import { baseActividadColumns, actividadActionColumn } from "./actividadesColumns";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";
import { ErrorState } from "@/components/shared/states/ErrorState";
import { ActividadesFiltros } from "@/features/crm/components/actividades/ActividadesFiltros";
import { actividadEntidadHref, actividadEntidadNombre } from "@/features/crm/domain/actividadEntidad";
import { ActividadMobileCard } from "@/features/crm/components/ActividadMobileCard";


type ActividadesFilters = { tipo: string; estado: string; responsable: string } & Record<string, string>;
const DEFAULTS: ActividadesFilters = { tipo: "todos", estado: "pendientes", responsable: "todos" };

export default function Actividades() {
  useDocumentTitle('Actividades CRM');
  const { canCrearActividad, canGestionarActividad } = usePermissions();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const filtroParam = searchParams.get("filtro");
  const vencidasOnly = filtroParam === "vencidas";

  const list = useServerPagedList<CrmActividadRow, ActividadesFilters>({
    queryKey: queryKeys.crm.actividades.paged(user?.id, vencidasOnly ? "vencidas" : "todas"),
    defaultFilters: DEFAULTS,
    filterLabels: { tipo: "Tipo", estado: "Estado", responsable: "Responsable" },
    defaultPageSize: 100,
    defaultSort: { key: "fecha_programada", dir: "asc" },
    sortableKeys: ACTIVIDAD_SORTABLE_KEYS,
    fetcher: async ({ search, filters, sortKey, sortDir, page, pageSize }) => {
      const { data, count } = await listActividadesAgenda({
        search,
        tipo: (filters.tipo as CrmActividadTipo | "todos") ?? "todos",
        // v13.823.49 — `?filtro=vencidas` se resuelve en la consulta: pendientes,
        // del responsable actual y con fecha programada anterior a ahora.
        estado: vencidasOnly ? "pendientes" : ((filters.estado as "pendientes" | "completadas" | "todas") ?? "pendientes"),
        responsable: vencidasOnly ? "mias" : ((filters.responsable as "mias" | "todos") ?? "todos"),
        vencidas: vencidasOnly,
        page,
        pageSize,
        userId: user?.id,
        userEmail: user?.email,
        sortKey: (sortKey ?? "fecha_programada") as ActividadSortKey,
        sortDir: sortDir ?? "asc",
      });
      return { rows: data, count };
    },
  });

  // Shortcut `?filtro=vencidas`: preconfigura pendientes + mías la primera vez.
  const setFilterRef = useRef(list.setFilter);
  setFilterRef.current = list.setFilter;
  useEffect(() => {
    if (vencidasOnly) {
      setFilterRef.current("estado", "pendientes");
      setFilterRef.current("responsable", "mias");
    }
  }, [vencidasOnly]);

  // P2-4: nunca exponer filas de la consulta anterior bajo filtros nuevos.
  const items = list.isStaleView ? [] : list.rows;
  const columns = canCrearActividad
    ? [...baseActividadColumns, actividadActionColumn((a) => canGestionarActividad(a.responsable_id))]
    : baseActividadColumns;

  const limpiarFiltro = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("filtro");
    setSearchParams(next);
  };

  return (
    <PageContainer width="wide">
      <PageHeader
        title="Actividades"
        description="Registro de llamadas, reuniones y tareas de seguimiento CRM"
      />
      <CrmSubheader
        context={list.isStaleView ? "Actualizando…" : pluralizar(list.count, "actividad", { plural: "actividades" })}
        actions={vencidasOnly ? (
          <Button variant="outline" size="sm" onClick={limpiarFiltro} className="h-7">
            <X className="h-3 w-3 mr-1" /> Filtro: Vencidas
          </Button>
        ) : undefined}
      />

      <UnifiedFiltersBar
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Buscar por asunto…"
        chips={list.activeChips}
        activeCount={list.activeCount}
        onClearAll={list.resetAll}
        primary={
          <ActividadesFiltros filters={list.filters} onChange={list.setFilter} />
        }
      />
      {(list.activeCount > 0 || list.search) && (
        <p className="text-body-sm text-muted-foreground">Esta vista está filtrada. Las actividades nuevas se mostrarán sólo si coinciden con los filtros.</p>
      )}
      <Card>
        <CardContent className="p-0">
          {items.some(a => a.entidad_estado === "error") && (
            <div role="status" className="flex flex-wrap items-center gap-2 border-b p-3 text-body-sm text-muted-foreground">
              Algunos nombres no se pudieron consultar. Las actividades siguen disponibles.
              <Button variant="outline" size="sm" onClick={() => void list.refetch()}>Reintentar nombres</Button>
            </div>
          )}
          {list.error ? (
            <ErrorState className="m-4" onRetry={() => void list.refetch()} />
          ) : (
          <ResponsiveDataTable
            columns={columns}
            data={items}
            isLoading={list.isLoading || list.isStaleView}
            emptyMessage="Sin actividades"
            rowKey={(a) => a.id}
            getRowHref={actividadEntidadHref}
            getRowAriaLabel={a => `Abrir ${actividadEntidadNombre(a)} · ${a.asunto}`}
            density={TABLE_DENSITY.listado}
            sortMode="server"
            controlledSort={list.controlledSort}
            onSortChange={(key, dir) => list.setSort(key, dir)}
            pagination={{
              ...list.pagination,
              pageSizeOptions: [50, 100, 200, 500],
              pageSizeLabels: { 500: "500" },
            }}
            tableClassName="w-full table-fixed"
            mobileCard={(actividad) => (
              <ActividadMobileCard
                actividad={actividad}
                puedeGestionar={canCrearActividad && canGestionarActividad(actividad.responsable_id)}
              />
            )}
          />
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
