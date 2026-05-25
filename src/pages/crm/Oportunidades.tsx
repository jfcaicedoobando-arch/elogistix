/**
 * /crm/oportunidades — Pipeline con vista Kanban (DnD) y tabla.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Target, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SearchInput from "@/components/selects/SearchInput";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { useDebounce, usePermissions } from "@/hooks/shared";
import { FloatingActionButton } from "@/components/shared/FloatingActionButton";
import { useToast } from "@/hooks/use-toast";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { formatCurrencyCompact } from "@/lib/formatters";
import OportunidadKanban from "@/components/crm/OportunidadKanban";
import NuevaOportunidadDialog from "@/components/crm/NuevaOportunidadDialog";
import OportunidadesFiltersBar, {
  FILTROS_DEFAULT,
  type OportunidadesFiltros,
} from "@/components/crm/OportunidadesFiltersBar";
import {
  useOportunidades,
  useMoverEtapa,
  type CrmOportunidadRow,
} from "@/hooks/crm/useOportunidades";
import { useEtapasPipeline, type CrmEtapaRow } from "@/hooks/crm/useEtapasPipeline";
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

export default function Oportunidades() {
  const navigate = useNavigate();
  const { canEdit } = usePermissions();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filtros, setFiltros] = useState<OportunidadesFiltros>(FILTROS_DEFAULT);
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
  const opsRaw = data?.data ?? [];

  // Filtros cliente-side
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

  const mover = useMoverEtapa();

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

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        icon={<Target className="h-6 w-6 text-primary" />}
        title="Oportunidades"
        description={`${ops.length} de ${opsRaw.length} oportunidades · pipeline ${formatCurrencyCompact(ops.reduce((s, o) => s + Number(o.monto_estimado ?? 0), 0))}`}
        actions={
          canEdit ? (
            <Button onClick={() => setDialogOpen(true)} className="hidden md:flex">
              <Plus className="h-4 w-4 mr-1" /> Nueva oportunidad
            </Button>
          ) : null
        }
      />

      <Card>
        <CardContent className="p-4 space-y-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nombre o cliente..." />
          <OportunidadesFiltersBar
            etapas={etapas as CrmEtapaRow[]}
            vendedores={vendedores}
            value={filtros}
            onChange={setFiltros}
          />
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

      <NuevaOportunidadDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={(id) => navigate(`/crm/oportunidades/${id}`)}
      />

      {canEdit && (
        <FloatingActionButton
          icon={<Plus className="h-6 w-6" />}
          label="Nueva oportunidad"
          onClick={() => setDialogOpen(true)}
        />
      )}
    </div>
  );
}
