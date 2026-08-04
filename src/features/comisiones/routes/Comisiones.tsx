/**
 * Comisiones — devengadas + liquidaciones + config.
 *
 * v13.173.2 (Ola 1 · Filtros globales): la pestaña "Devengadas" se migra al
 * primitivo `useClientPagedList` + `<UnifiedFiltersBar />`. Los tres filtros
 * server (vendedora, estado, periodo) se leen/escriben en la URL vía `nuqs`
 * y se propagan al RPC; encima, se añade búsqueda por factura/cliente, orden
 * por columna y paginación 10/20/50/100.
 */
import { useMemo } from "react";
import { PageContainer } from "@/components/shared/PageContainer";
import { Card, CardContent } from "@/components/ui/card";
import { KpiCard } from "@/components/shared/KpiCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useQueryStates, parseAsString, parseAsStringLiteral } from "nuqs";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { MonthPickerMx } from "@/components/ui/month-picker-mx";
import { formatCurrency } from "@/lib/formatters";
import { useComisionesDevengadas, useUsuariosVendedores } from "@/features/comisiones/hooks";
import { useVendedorasEmailWarning } from "@/features/comisiones/hooks/useVendedorasEmailWarning";
import { buildComisionesColumns } from "@/features/comisiones/components/comisionesColumns";
import { TabLiquidaciones } from "@/features/comisiones/components/TabLiquidaciones";
import { TabVendedorasConfig } from "@/features/comisiones/components/TabVendedorasConfig";
import type { EstadoComision, ComisionDevengada } from "@/features/comisiones/services";
import { UnifiedFiltersBar } from "@/components/shared/filters/UnifiedFiltersBar";
import { useClientPagedList } from "@/hooks/shared/useClientPagedList";
import { CargaGuard } from "@/components/shared/states/CargaGuard";


const ESTADO_VALUES = ["todos", "Devengada", "Liquidada", "Cancelada"] as const;
type EstadoUrl = typeof ESTADO_VALUES[number];

interface ClientFilters extends Record<string, string> {
  // No hay filtros cliente-locales; el sort/search/pagination del primitivo
  // se combinan con los filtros server que viven en URL aparte (v, estado, m).
  _unused: string;
}
const CLIENT_DEFAULTS: ClientFilters = { _unused: "" };

export default function Comisiones() {
  // Filtros que van al servidor — sincronizados con la URL igual que el resto.
  const [server, setServer] = useQueryStates({
    v: parseAsString.withDefault("todas"),
    estado: parseAsStringLiteral(ESTADO_VALUES).withDefault("todos"),
    m: parseAsString.withDefault(""),
  });

  const setVendedora = (value: string) =>
    setServer({ v: value === "todas" ? null : value });
  const setEstado = (value: EstadoUrl) =>
    setServer({ estado: value === "todos" ? null : value });
  const setPeriodo = (value: string) => setServer({ m: value || null });

  const { data: vendedoras = [] } = useUsuariosVendedores();
  const { data: comisiones = [], isLoading, isError, refetch, kpis } = useComisionesDevengadas({
    vendedora_id: server.v as string | "todas",
    estado: server.estado as EstadoComision | "todos",
    periodo: server.m || undefined,
  });

  useVendedorasEmailWarning(vendedoras);

  const columns = useMemo(() => buildComisionesColumns(), []);

  const paged = useClientPagedList<ComisionDevengada, ClientFilters>({
    data: comisiones,
    isLoading,
    defaultFilters: CLIENT_DEFAULTS,
    defaultSort: { key: "fecha", dir: "desc" },
    searchAccessor: (r) =>
      `${r.factura_numero ?? ""} ${r.cliente_nombre ?? ""} ${r.expediente ?? ""}`,
    sorters: {
      factura: (a, b) => (a.factura_numero ?? "").localeCompare(b.factura_numero ?? ""),
      cliente: (a, b) => (a.cliente_nombre ?? "").localeCompare(b.cliente_nombre ?? ""),
      cobrado: (a, b) => a.monto_cobrado_mxn - b.monto_cobrado_mxn,
      utilidad: (a, b) => a.utilidad_prorrateada_mxn - b.utilidad_prorrateada_mxn,
      porcentaje: (a, b) => a.porcentaje_aplicado - b.porcentaje_aplicado,
      comision: (a, b) => a.comision_mxn - b.comision_mxn,
      fecha: (a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""),
    },
  });

  return (
    <PageContainer>
      <PageHeader
        title="Comisiones"
        description="Comisiones devengadas al cobrar facturas y liquidaciones a vendedoras"
      />

      <CargaGuard
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        errorTitle="No se pudieron cargar las comisiones"
        errorDescription="Ocurrió un error al obtener las comisiones devengadas. Intenta de nuevo."
      >
      <Tabs defaultValue="devengadas" className="space-y-4">
        <TabsList>
          <TabsTrigger value="devengadas">Devengadas</TabsTrigger>
          <TabsTrigger value="liquidaciones">Liquidaciones</TabsTrigger>
          <TabsTrigger value="config">Configuración</TabsTrigger>
        </TabsList>

        <TabsContent value="devengadas" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <KpiCard label="Devengado del mes" value={formatCurrency(kpis.devengado_mes_mxn, "MXN")} />
            <KpiCard label="Pendiente de liquidar" value={formatCurrency(kpis.pendiente_liquidar_mxn, "MXN")} />
            <KpiCard label="Liquidado del mes" value={formatCurrency(kpis.liquidado_mes_mxn, "MXN")} />
          </div>

          <UnifiedFiltersBar
            search={paged.search}
            onSearchChange={paged.setSearch}
            searchPlaceholder="Buscar factura, cliente o expediente…"
            primary={
              <>
                <Select value={server.v} onValueChange={setVendedora}>
                  <SelectTrigger className="w-[200px]" aria-label="Vendedora">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas las vendedoras</SelectItem>
                    {vendedoras.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={server.estado} onValueChange={(v) => setEstado(v as EstadoUrl)}>
                  <SelectTrigger className="w-[160px]" aria-label="Estado">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ESTADO_VALUES.map((e) => (
                      <SelectItem key={e} value={e}>
                        {e === "todos" ? "Todos los estados" : e}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <MonthPickerMx
                  value={server.m}
                  onChange={setPeriodo}
                  className="w-[180px]"
                />
              </>
            }
            chips={paged.activeChips}
            activeCount={
              paged.activeCount +
              (server.v !== "todas" ? 1 : 0) +
              (server.estado !== "todos" ? 1 : 0) +
              (server.m ? 1 : 0)
            }
            onClearAll={() => {
              paged.resetAll();
              setServer({ v: null, estado: null, m: null });
            }}
          />

          <Card>
            <CardContent density="flush">
              <DataTable<ComisionDevengada>
                columns={columns}
                data={paged.rows}
                isLoading={paged.isLoading}
                emptyMessage="No hay comisiones devengadas"
                rowKey={(c) => c.id}
                sortMode="server"
                controlledSort={paged.controlledSort}
                onSortChange={paged.setSort}
                pagination={paged.pagination}
                density="comfortable"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="liquidaciones">
          <TabLiquidaciones vendedoras={vendedoras} />
        </TabsContent>

        <TabsContent value="config">
          <TabVendedorasConfig vendedoras={vendedoras} />
        </TabsContent>
      </Tabs>
      </CargaGuard>
    </PageContainer>
  );
}
