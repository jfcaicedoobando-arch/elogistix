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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CrmSubheader } from "@/features/crm/components/CrmSubheader";
import { DataTable } from "@/components/shared/DataTable";
import { UnifiedFiltersBar } from "@/components/shared/filters/UnifiedFiltersBar";
import { useServerPagedList } from "@/hooks/shared/useServerPagedList";
import { usePermissions, useDocumentTitle } from "@/hooks/shared";
import { useAuth } from "@/lib/contexts/AuthContext";
import {
  listActividades, ACTIVIDAD_SORTABLE_KEYS,
  type ActividadSortKey,
} from "@/features/crm/services/actividades";
import {
  ACTIVIDAD_TIPOS,
  type CrmActividadRow, type CrmActividadTipo,
} from "@/features/crm/hooks";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { queryKeys } from "@/lib/query";
import { pluralizar } from "@/lib/format/pluralizar";
import { baseActividadColumns, actividadActionColumn } from "./actividadesColumns";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";
import { ErrorState } from "@/components/shared/states/ErrorState";


type ActividadesFilters = { tipo: string; estado: string; responsable: string } & Record<string, string>;
const DEFAULTS: ActividadesFilters = { tipo: "todos", estado: "pendientes", responsable: "todos" };

export default function Actividades() {
  useDocumentTitle('Actividades CRM');
  const { canEditCrm } = usePermissions();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const filtroParam = searchParams.get("filtro");
  const vencidasOnly = filtroParam === "vencidas";

  const list = useServerPagedList<CrmActividadRow, ActividadesFilters>({
    queryKey: [...queryKeys.crm.actividades.paged(user?.id), vencidasOnly ? "vencidas" : "todas"],
    defaultFilters: DEFAULTS,
    filterLabels: { tipo: "Tipo", estado: "Estado", responsable: "Responsable" },
    defaultPageSize: 100,
    defaultSort: { key: "fecha_programada", dir: "asc" },
    sortableKeys: ACTIVIDAD_SORTABLE_KEYS,
    fetcher: async ({ search, filters, sortKey, sortDir, page, pageSize }) => {
      const { data, count } = await listActividades({
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

  const items = list.rows;
  const columns = canEditCrm ? [...baseActividadColumns, actividadActionColumn] : baseActividadColumns;

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
        context={pluralizar(list.count, "actividad", { plural: "actividades" })}
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
          <>
            <Select
              value={list.filters.tipo}
              onValueChange={(v) => list.setFilter("tipo", v)}
            >
              <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los tipos</SelectItem>
                {ACTIVIDAD_TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select
              value={list.filters.estado}
              onValueChange={(v) => list.setFilter("estado", v)}
            >
              <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pendientes">Pendientes</SelectItem>
                <SelectItem value="completadas">Completadas</SelectItem>
                <SelectItem value="todas">Todas</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={list.filters.responsable}
              onValueChange={(v) => list.setFilter("responsable", v)}
            >
              <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="mias">Mis actividades</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
      />
      <Card>
        <CardContent className="p-0">
          {list.error ? (
            <ErrorState className="m-4" onRetry={() => void list.refetch()} />
          ) : (
          <DataTable
            columns={columns}
            data={items}
            isLoading={list.isLoading}
            emptyMessage="Sin actividades"
            rowKey={(a) => a.id}
            density={TABLE_DENSITY.listado}
            sortMode="server"
            controlledSort={list.controlledSort}
            onSortChange={(key, dir) => list.setSort(key, dir)}
            pagination={{
              ...list.pagination,
              pageSizeOptions: [50, 100, 200, 500],
              pageSizeLabels: { 500: "500" },
            }}
          />
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
