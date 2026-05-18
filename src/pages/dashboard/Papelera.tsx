import { useState } from "react";
import { Trash2, RotateCcw, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { usePermissions } from "@/hooks/shared";
import { useToast } from "@/hooks/use-toast";
import { Navigate } from "react-router-dom";
import { listTrash, restoreRecord, purgeRecord, type SoftTable as SoftTableSvc, type TrashRow as TrashRowSvc } from "@/services/admin";

type SoftTable = SoftTableSvc;
type TrashRow = TrashRowSvc;

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
  { value: "conceptos_costo", label: "Conceptos de costo" },
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
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tabla, setTabla] = useState<SoftTable>("embarques");

  const { data, isLoading } = useQuery({
    queryKey: ["papelera", tabla],
    queryFn: () => listTrash(tabla, 200, 0),
    enabled: isAdmin,
  });

  const restore = useMutation({
    mutationFn: (id: string) => restoreRecord(tabla, id),
    onSuccess: () => {
      toast({ title: "Registro restaurado" });
      qc.invalidateQueries({ queryKey: ["papelera", tabla] });
    },
    onError: (e: Error) => toast({ title: "Error al restaurar", description: e.message, variant: "destructive" }),
  });

  const purge = useMutation({
    mutationFn: (id: string) => purgeRecord(tabla, id),
    onSuccess: () => {
      toast({ title: "Registro eliminado definitivamente" });
      qc.invalidateQueries({ queryKey: ["papelera", tabla] });
    },
    onError: (e: Error) => toast({ title: "Error al purgar", description: e.message, variant: "destructive" }),
  });

  if (!isAdmin) return <Navigate to="/" replace />;

  const columns: DataTableColumn<TrashRow>[] = [
    {
      key: "label",
      header: "Registro",
      render: (r) => <span className="font-medium truncate block max-w-[280px]">{r.label}</span>,
    },
    {
      key: "deleted_at",
      header: "Eliminado",
      render: (r) => <span className="text-sm text-muted-foreground">{dtf.format(new Date(r.deleted_at))}</span>,
    },
    {
      key: "deleted_by_email",
      header: "Usuario",
      render: (r) => (
        <span className="text-sm text-muted-foreground">
          {r.deleted_by_email ?? (r.deleted_by ? r.deleted_by.slice(0, 8) : "—")}
        </span>
      ),
    },
    {
      key: "acciones",
      header: "Acciones",
      align: "right",
      render: (r) => (
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
            onClick={() => {
              if (window.confirm("¿Eliminar definitivamente? Esta acción no se puede deshacer.")) {
                purge.mutate(r.id);
              }
            }}
            disabled={restore.isPending || purge.isPending}
          >
            <X className="h-3.5 w-3.5 mr-1" /> Purgar
          </Button>
        </div>
      ),
    },
  ];

  const rows = data ?? [];

  return (
    <div className="space-y-6">
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
    </div>
  );
}
