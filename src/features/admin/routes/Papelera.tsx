import { useState, useMemo } from "react";
import { Trash2, RotateCcw, X } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  SelectGroup, SelectLabel,
} from "@/components/ui/select";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import DoubleConfirmDeleteDialog from "@/components/shared/DoubleConfirmDeleteDialog";
import { usePermissions } from "@/hooks/shared";
import { Navigate } from "react-router-dom";
import { usePapelera, type SoftTable, type TrashRow } from "@/features/admin/hooks";

interface TablaMeta {
  value: SoftTable;
  label: string;
  grupo: "Operaciones" | "Comercial" | "Facturación" | "CxP / Tesorería" | "CRM" | "Catálogos";
}

const TABLAS: TablaMeta[] = [
  // Operaciones
  { value: "embarques", label: "Embarques", grupo: "Operaciones" },
  { value: "embarque_contenedores", label: "Contenedores de embarque", grupo: "Operaciones" },
  { value: "documentos_embarque", label: "Documentos de embarque", grupo: "Operaciones" },
  { value: "eventos_embarque", label: "Eventos de embarque", grupo: "Operaciones" },
  { value: "notas_embarque", label: "Notas de embarque", grupo: "Operaciones" },
  { value: "seguros_embarque", label: "Seguros de embarque", grupo: "Operaciones" },
  { value: "conceptos_costo", label: "Costos directos del embarque", grupo: "Operaciones" },
  { value: "conceptos_venta", label: "Conceptos de venta", grupo: "Operaciones" },
  // Comercial
  { value: "clientes", label: "Clientes", grupo: "Comercial" },
  { value: "contactos_cliente", label: "Contactos de cliente", grupo: "Comercial" },
  { value: "cotizaciones", label: "Cotizaciones", grupo: "Comercial" },
  { value: "cotizacion_costos", label: "Costos de cotización", grupo: "Comercial" },
  // Facturación
  { value: "facturas", label: "Facturas", grupo: "Facturación" },
  { value: "conceptos_factura", label: "Conceptos de factura", grupo: "Facturación" },
  { value: "factura_notas_credito", label: "Notas de crédito (cliente)", grupo: "Facturación" },
  { value: "pagos_factura", label: "Pagos de factura", grupo: "Facturación" },
  { value: "proformas", label: "Proformas", grupo: "Facturación" },
  { value: "proforma_conceptos_consolidados", label: "Conceptos de proforma", grupo: "Facturación" },
  // CxP / Tesorería
  { value: "proveedor_facturas", label: "Facturas de proveedor", grupo: "CxP / Tesorería" },
  { value: "proveedor_notas_credito", label: "Notas de crédito (proveedor)", grupo: "CxP / Tesorería" },
  { value: "pagos_proveedor", label: "Pagos a proveedor", grupo: "CxP / Tesorería" },
  { value: "cuentas_bancarias", label: "Cuentas bancarias", grupo: "CxP / Tesorería" },
  // CRM
  { value: "crm_leads", label: "Leads", grupo: "CRM" },
  { value: "crm_oportunidades", label: "Oportunidades", grupo: "CRM" },
  { value: "crm_actividades", label: "Actividades CRM", grupo: "CRM" },
  { value: "crm_comentarios_oportunidad", label: "Comentarios de oportunidad", grupo: "CRM" },
  { value: "crm_etapas_pipeline", label: "Etapas de pipeline", grupo: "Catálogos" },
  { value: "crm_motivos_perdida", label: "Motivos de pérdida", grupo: "Catálogos" },
  { value: "crm_plantillas_mensaje", label: "Plantillas de mensaje", grupo: "Catálogos" },
];

const GRUPOS = ["Operaciones", "Comercial", "Facturación", "CxP / Tesorería", "CRM", "Catálogos"] as const;

const dtf = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default function Papelera() {
  const { isAdmin } = usePermissions();
  const { tabla, setTabla, rows, isLoading, counts, restore, purge } = usePapelera(isAdmin);
  const [purgeTarget, setPurgeTarget] = useState<TrashRow | null>(null);

  const countByTable = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of counts) map.set(c.tabla, Number(c.total ?? 0));
    return map;
  }, [counts]);

  const totalPapelera = useMemo(
    () => counts.reduce((acc, c) => acc + Number(c.total ?? 0), 0),
    [counts],
  );

  if (!isAdmin) return <Navigate to="/" replace />;

  const columns: ColumnDef<TrashRow, unknown>[] = defineColumns<TrashRow>([
    {
      id: "label",
      header: "Registro",
      cell: ({ row }) => <span className="font-medium truncate block max-w-[280px]">{row.original.label}</span>,
    },
    {
      id: "deleted_at",
      header: "Eliminado",
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{dtf.format(new Date(row.original.deleted_at))}</span>,
    },
    {
      id: "deleted_by_email",
      header: "Usuario",
      cell: ({ row }) => {
        const r = row.original;
        return (
          <span className="text-sm text-muted-foreground">
            {r.deleted_by_email ?? (r.deleted_by ? r.deleted_by.slice(0, 8) : "—")}
          </span>
        );
      },
    },
    {
      id: "acciones",
      header: "Acciones",
      meta: { align: "right" },
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => restore.mutate(r.id)}
              disabled={restore.isPending || purge.isPending}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restaurar
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setPurgeTarget(r)}
              disabled={restore.isPending || purge.isPending}
            >
              <X className="h-3.5 w-3.5 mr-1" /> Purgar
            </Button>
          </div>
        );
      },
    },
  ]);

  return (
    <PageContainer>
      <PageHeader
        icon={<Trash2 className="h-6 w-6" />}
        title="Papelera"
        description="Registros eliminados (soft delete). Restaura o purga definitivamente. Al restaurar un embarque, sus contenedores, documentos, notas, eventos, facturas, seguros y conceptos se recuperan juntos."
      />

      <div className="flex items-center gap-3 flex-wrap">
        <Select value={tabla} onValueChange={(v) => setTabla(v as SoftTable)}>
          <SelectTrigger className="w-[320px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GRUPOS.map((g) => {
              const items = TABLAS.filter((t) => t.grupo === g);
              if (items.length === 0) return null;
              return (
                <SelectGroup key={g}>
                  <SelectLabel>{g}</SelectLabel>
                  {items.map((t) => {
                    const n = countByTable.get(t.value) ?? 0;
                    return (
                      <SelectItem key={t.value} value={t.value}>
                        <span className="flex items-center justify-between gap-3 w-full">
                          <span>{t.label}</span>
                          {n > 0 && (
                            <Badge variant="secondary" className="ml-auto">{n}</Badge>
                          )}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectGroup>
              );
            })}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">
          {rows.length} {rows.length === 1 ? "registro" : "registros"} en esta tabla
        </span>
        <span className="text-xs text-muted-foreground ml-auto">
          Total en papelera: <strong>{totalPapelera}</strong>
        </span>
      </div>

      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={rows}
            isLoading={isLoading}
            rowKey={(r) => r.id}
            emptyMessage="La papelera está vacía"
            density="comfortable"
          />
        </CardContent>
      </Card>

      <DoubleConfirmDeleteDialog
        open={!!purgeTarget}
        onOpenChange={(v) => { if (!v) setPurgeTarget(null); }}
        entityName={purgeTarget ? `«${purgeTarget.label}»` : "este registro"}
        description="El registro se eliminará definitivamente de la base de datos. Esta acción no se puede deshacer."
        finalDescription="Una vez purgado no podrás recuperarlo desde la papelera. ¿Continuar?"
        isPending={purge.isPending}
        onConfirm={async () => {
          if (purgeTarget) await purge.mutateAsync(purgeTarget.id);
          setPurgeTarget(null);
        }}
      />
    </PageContainer>
  );
}
