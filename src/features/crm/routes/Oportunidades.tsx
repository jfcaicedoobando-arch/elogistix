"use memo";
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
import { Collapsible, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MobileFiltersSheet } from "@/components/shared/MobileFiltersSheet";
import SearchInput from "@/components/shared/SearchInput";
import { CrmSubheader } from "@/features/crm/components/CrmSubheader";
import { DataTable } from "@/components/shared/DataTable";
import { useDebounce, useDocumentTitle } from "@/hooks/shared";
import { formatCurrencyCompact } from "@/lib/formatters";
import { LoadingState } from "@/components/shared/states/LoadingState";
import OportunidadKanban from "@/features/crm/components/OportunidadKanban";
import OportunidadesFiltersBar from "@/features/crm/components/OportunidadesFiltersBar";
import OportunidadesViewChips from "@/features/crm/components/OportunidadesViewChips";
import NuevaActividadDialog from "@/features/crm/components/NuevaActividadDialog";
import { FILTROS_DEFAULT, type OportunidadesFiltros } from "@/features/crm/components/oportunidadesFiltersTypes";
import { useOportunidades, useEtapasPipeline, type CrmEtapaRow } from "@/features/crm/hooks";
import { useMoverOportunidadEtapa } from "@/features/crm/hooks/useMoverOportunidadEtapa";
import { useUsuarios } from "@/features/admin/hooks/usuario";
import { oportunidadesColumns, activosFiltros } from "./oportunidadesTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";

export default function Oportunidades() {
  useDocumentTitle('Oportunidades');
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filtros, setFiltros] = useState<OportunidadesFiltros>(FILTROS_DEFAULT);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const debounced = useDebounce(search, 300);

  const { data: etapas = [] } = useEtapasPipeline();
  const { data: usuarios = [] } = useUsuarios();
  const vendedores = useMemo(
    () =>
      usuarios
        .filter((u) => ["admin", "operador", "vendedor", "gerente_comercial", "super_admin"].includes(u.role))
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

  const { handleMover, proximoPaso, cerrarProximoPaso } = useMoverOportunidadEtapa({
    etapas: etapas as CrmEtapaRow[],
    oportunidades: opsRaw,
  });

  const activos = activosFiltros(filtros);
  const totalPipeline = ops.reduce((s, o) => s + Number(o.monto_estimado ?? 0), 0);

  return (
    <PageContainer>
      <PageHeader
        title="Oportunidades"
        description="Pipeline de ventas por etapa con vista Kanban y tabla"
      />
      <CrmSubheader context={`${ops.length} de ${opsRaw.length} oportunidades · pipeline ${formatCurrencyCompact(totalPipeline)}`} />

      <Card>
        <CardContent className="p-3 space-y-3">
          <OportunidadesViewChips value={filtros} onChange={setFiltros} />
          {/* Mobile */}
          <div className="flex gap-2 md:hidden">
            <div className="flex-1 min-w-0">
              <SearchInput value={search} onChange={setSearch} placeholder="Buscar..." />
            </div>
            <MobileFiltersSheet
              open={filtersOpen}
              onOpenChange={setFiltersOpen}
              title="Filtros de oportunidades"
              activeCount={activos}
              onClearAll={() => setFiltros(FILTROS_DEFAULT)}
            >
              <OportunidadesFiltersBar
                etapas={etapas as CrmEtapaRow[]}
                vendedores={vendedores}
                value={filtros}
                onChange={setFiltros}
              />
            </MobileFiltersSheet>
          </div>
          {/* Desktop */}
          <div className="hidden md:flex md:flex-row md:gap-2 md:items-center">
            <div className="flex-1">
              <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nombre o cliente..." />
            </div>
            <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">
                  {filtersOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  Filtros
                  {activos > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-2xs">{activos}</Badge>}
                </Button>
              </CollapsibleTrigger>
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
            <LoadingState label="Cargando oportunidades…" />
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
                columns={oportunidadesColumns}
                data={ops}
                isLoading={isLoading}
                emptyMessage="No hay oportunidades"
                getRowHref={(o) => `/crm/oportunidades/${o.id}`}
                rowKey={(o) => o.id}
                density="comfortable"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Disciplina de pipeline: próximo paso tras mover a una etapa abierta. */}
      <NuevaActividadDialog
        open={proximoPaso != null}
        onOpenChange={(o) => { if (!o) cerrarProximoPaso(); }}
        defaultEntidad={
          proximoPaso
            ? { tipo: "oportunidad", id: proximoPaso.id, label: proximoPaso.nombre }
            : undefined
        }
        onCreated={cerrarProximoPaso}
      />
    </PageContainer>
  );
}
