/**
 * /crm/oportunidades — Pipeline con vista Kanban (DnD) y tabla.
 * Filtros avanzados colapsables para ganar espacio vertical.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import SearchInput from "@/components/selects/SearchInput";
import { CrmSubheader } from "@/components/crm/CrmSubheader";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { useDebounce } from "@/hooks/shared";
import { useToast } from "@/hooks/shared";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { formatCurrencyCompact } from "@/lib/formatters";
import OportunidadKanban from "@/components/crm/OportunidadKanban";
import OportunidadesFiltersBar from "@/components/crm/OportunidadesFiltersBar";
import {
  FILTROS_DEFAULT,
  type OportunidadesFiltros,
} from "@/components/crm/oportunidadesFiltersTypes";
import {
  useOportunidades,
  type CrmOportunidadRow,
} from "@/hooks/crm";
import { useMoverEtapaConAutomatizacion } from "@/hooks/crm";
import { useEtapasPipeline, type CrmEtapaRow } from "@/hooks/crm";
import { useUsuarios } from "@/hooks/usuario";

const columns: ColumnDef<CrmOportunidadRow, unknown>[] = defineColumns<CrmOportunidadRow>([
  { id: "nombre", header: "Oportunidad", meta: { className: "font-medium" }, cell: ({ row }) => row.original.nombre },
  { id: "cliente", header: "Cliente", cell: ({ row }) => row.original.cliente_nombre || "—" },
  {
    id: "monto",
    header: "Monto",
    meta: { className: "text-right tabular-nums text-xs" },
    cell: ({ row }) => formatCurrencyCompact(Number(row.original.monto_estimado ?? 0), row.original.moneda),
  },
  { id: "prob", header: "Prob", meta: { className: "text-center text-xs" }, cell: ({ row }) => `${row.original.probabilidad}%` },
  { id: "fecha", header: "Cierre est.", meta: { className: "text-xs" }, cell: ({ row }) => row.original.fecha_estimada_cierre || "—" },
  { id: "vendedor", header: "Vendedor", meta: { className: "text-xs" }, cell: ({ row }) => row.original.vendedor_email || "—" },
]);

function activosFiltros(f: OportunidadesFiltros): number {
  let n = 0;
  if (f.etapaId !== "todas") n++;
  if (f.vendedorId !== "todos") n++;
  if (f.cierreDesde) n++;
  if (f.cierreHasta) n++;
  if (f.montoMin) n++;
  return n;
}

export default function Oportunidades() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filtros, setFiltros] = useState<OportunidadesFiltros>(FILTROS_DEFAULT);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const debounced = useDebounce(search, 300);

  const { data: etapas = [] } = useEtapasPipeline();
  const { data: usuarios = [] } = useUsuarios();
  const vendedores = useMemo(
    () =>
      usuarios
        .filter((u) => ["admin", "operador", "vendedor", "super_admin"].includes(u.role))
        .map((u) => ({ id: u.user_id, email: u.email })),
    [usuarios],
  );
  const { data, isLoading } = useOportunidades({ search: debounced, pageSize: 500 });
  const opsRaw = useMemo(() => data?.data ?? [], [data]);

  const ops = useMemo(() => {
    return opsRaw.filter((o) => {
      if (filtros.etapaId !== "todas" && o.etapa_id !== filtros.etapaId) return false;
      if (filtros.vendedorId !== "todos" && o.vendedor_id !== filtros.vendedorId) return false;
      if (filtros.cierreDesde && (!o.fecha_estimada_cierre || o.fecha_estimada_cierre < filtros.cierreDesde)) return false;
      if (filtros.cierreHasta && (!o.fecha_estimada_cierre || o.fecha_estimada_cierre > filtros.cierreHasta)) return false;
      if (filtros.montoMin) {
        const min = Number(filtros.montoMin);
        if (Number.isFinite(min) && Number(o.monto_estimado ?? 0) < min) return false;
      }
      return true;
    });
  }, [opsRaw, filtros]);

  const mover = useMoverEtapaConAutomatizacion();
  const handleMover = async (id: string, etapaId: string, prob: number) => {
    try {
      await mover.mutateAsync({ id, etapa_id: etapaId, probabilidad: prob });
      notifySuccess(toast, { title: "Etapa actualizada" });
    } catch (e) {
      notifyError(toast, {
        title: "No se pudo mover",
        description: e instanceof Error ? e.message : undefined,
      });
    }
  };

  const activos = activosFiltros(filtros);
  const totalPipeline = ops.reduce((s, o) => s + Number(o.monto_estimado ?? 0), 0);

  return (
    <div className="space-y-4 p-6">
      <CrmSubheader context={`${ops.length} de ${opsRaw.length} oportunidades · pipeline ${formatCurrencyCompact(totalPipeline)}`} />

      <Card>
        <CardContent className="p-3 space-y-3">
          <div className="flex flex-col md:flex-row gap-2 items-stretch md:items-center">
            <div className="flex-1">
              <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nombre o cliente..." />
            </div>
            <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">
                  {filtersOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  Filtros
                  {activos > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{activos}</Badge>}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="md:hidden mt-2">
                <OportunidadesFiltersBar
                  etapas={etapas as CrmEtapaRow[]}
                  vendedores={vendedores}
                  value={filtros}
                  onChange={setFiltros}
                />
              </CollapsibleContent>
            </Collapsible>
          </div>
          {filtersOpen && (
            <div className="hidden md:block">
              <OportunidadesFiltersBar
                etapas={etapas as CrmEtapaRow[]}
                vendedores={vendedores}
                value={filtros}
                onChange={setFiltros}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="kanban">
        <TabsList>
          <TabsTrigger value="kanban">Kanban</TabsTrigger>
          <TabsTrigger value="tabla">Tabla</TabsTrigger>
        </TabsList>
        <TabsContent value="kanban" className="mt-4">
          {isLoading ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Cargando…</div>
          ) : (
            <OportunidadKanban
              etapas={etapas as CrmEtapaRow[]}
              oportunidades={ops}
              onMover={handleMover}
              onClickCard={(id) => navigate(`/crm/oportunidades/${id}`)}
            />
          )}
        </TabsContent>
        <TabsContent value="tabla" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <DataTable
                columns={columns}
                data={ops}
                isLoading={isLoading}
                emptyMessage="No hay oportunidades"
                onRowClick={(o) => navigate(`/crm/oportunidades/${o.id}`)}
                rowKey={(o) => o.id}
                density="comfortable"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
