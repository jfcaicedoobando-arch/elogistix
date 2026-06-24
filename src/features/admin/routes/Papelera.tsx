import { useState } from "react";
import { Trash2, RotateCcw, X } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import DoubleConfirmDeleteDialog from "@/components/shared/DoubleConfirmDeleteDialog";
import { usePermissions } from "@/hooks/shared";
import { Navigate } from "react-router-dom";
import { usePapelera, type SoftTable, type TrashRow } from "@/features/admin/hooks";

const TABLAS: { value: SoftTable; label: string }[] = [
  { value: "embarques", label: "Embarques" },
  { value: "cotizaciones", label: "Cotizaciones" },
  { value: "clientes", label: "Clientes" },
  { value: "contactos_cliente", label: "Contactos de cliente" },
  { value: "documentos_embarque", label: "Documentos de embarque" },
  { value: "eventos_embarque", label: "Eventos de embarque" },
  { value: "notas_embarque", label: "Notas de embarque" },
  { value: "facturas", label: "Facturas" },
  { value: "conceptos_factura", label: "Conceptos de factura" },
  { value: "cotizacion_costos", label: "Costos de cotización" },
  { value: "proformas", label: "Proformas" },
  { value: "proforma_conceptos_consolidados", label: "Conceptos de proforma" },
  { value: "conceptos_costo", label: "Costos directos del embarque" },
  { value: "conceptos_venta", label: "Conceptos de venta" },
];

const dtf = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default function Papelera() {
  const { isAdmin } = usePermissions();
  const { tabla, setTabla, rows, isLoading, restore, purge } = usePapelera(isAdmin);
  const [purgeTarget, setPurgeTarget] = useState<TrashRow | null>(null);

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
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        icon={<Trash2 className="h-6 w-6" />}
        title="Papelera"
        description="Registros eliminados (soft delete). Restaura o purga definitivamente."
      />

      <div className="flex items-center gap-3 flex-wrap">
        <Select value={tabla} onValueChange={(v) => setTabla(v as SoftTable)}>
          <SelectTrigger className="w-[260px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TABLAS.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">
          {rows.length} {rows.length === 1 ? "registro" : "registros"}
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
    </div>
  );
}
