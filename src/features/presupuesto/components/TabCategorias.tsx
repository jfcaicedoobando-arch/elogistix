/**
 * Tab Configuración de categorías presupuestales.
 * v13.232.0 · Confirmación migrada a `ConfirmActionDialog` (Lote 7d.2).
 * Tabla migrada a `DataTable` (Ola F, punto 8).
 */
import { useState } from "react";
import { notifySuccess } from "@/lib/ui/appFeedback";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CardSkeleton } from "@/components/shared/skeletons";
import { ConfirmActionDialog } from "@/components/shared/dialogs/ConfirmActionDialog";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";
import { COL_W } from "@/components/shared/dataTable/columnWidths";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import {
  usePresupuestoCategorias, useEliminarCategoriaPresupuesto,
} from "@/features/presupuesto/hooks";
import { seedCategoriasDefault } from "@/features/presupuesto/services";
import type { CategoriaPresupuesto } from "@/features/presupuesto/services";
import { DialogCategoria } from "./DialogCategoria";
import { SectionHeading } from "@/components/shared/SectionHeading";

import { notifyError } from "@/lib/ui/appFeedback";
import { getErrorMessage } from "@/lib/errors";

function tipoLabelDe(c: CategoriaPresupuesto): string {
  if (c.tipo_contable === "CostoDirectoEmbarque") return "Costos directos de embarque (COGS)";
  if (c.tipo_contable === "Venta") return "Gastos de venta";
  return "Gastos de administración";
}

export function TabCategorias() {
  const { organizationId } = useOrganization();
  const cats = usePresupuestoCategorias(false);
  const eliminar = useEliminarCategoriaPresupuesto();
  const [open, setOpen] = useState(false);
  const [editar, setEditar] = useState<CategoriaPresupuesto | null>(null);
  const [borrarId, setBorrarId] = useState<string | null>(null);

  const handleSeed = async () => {
    if (!organizationId) return;
    try {
      await seedCategoriasDefault(organizationId);
      notifySuccess(undefined, { title: "Categorías por defecto creadas" });
      cats.refetch();
    } catch (e) {
      notifyError(undefined, { title: "No se pudieron crear las categorías por defecto", description: getErrorMessage(e), error: e, method: "FEATURES_PRESUPUESTO_COMPONENTS_TABCATEGORIAS_1" });
    }
  };

  const handleEliminar = async () => {
    if (!borrarId) return;
    try {
      await eliminar.mutateAsync(borrarId);
      notifySuccess(undefined, { title: "Categoría eliminada" });
      setBorrarId(null);
    } catch (e) {
      notifyError(undefined, { title: "No se pudo eliminar la categoría", description: getErrorMessage(e), error: e, method: "FEATURES_PRESUPUESTO_COMPONENTS_TABCATEGORIAS_2" });
    }
  };

  if (cats.isLoading) return <CardSkeleton lines={6} />;
  const sinDatos = (cats.data ?? []).length === 0;

  const columns: ColumnDef<CategoriaPresupuesto, unknown>[] = defineColumns<CategoriaPresupuesto>([
    { id: "nombre", header: "Nombre", meta: { width: COL_W.texto, className: "font-medium" }, cell: ({ row }) => row.original.nombre },
    {
      id: "tipo", header: "Tipo contable", meta: { width: COL_W.ruta },
      cell: ({ row }) => {
        const esGastoFijo = row.original.tipo_contable !== "CostoDirectoEmbarque";
        return <Badge variant={esGastoFijo ? "secondary" : "outline"}>{tipoLabelDe(row.original)}</Badge>;
      },
    },
    { id: "orden", header: "Orden", meta: { width: COL_W.tiny, align: "right" }, cell: ({ row }) => row.original.orden },
    {
      id: "activa", header: "Activa", meta: { width: COL_W.short, align: "center" },
      cell: ({ row }) => (row.original.activa ? "Sí" : "No"),
    },
    {
      id: "acciones", header: "Acciones", meta: { width: COL_W.short, align: "right" },
      cell: ({ row }) => {
        const c = row.original;
        return (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="sm" onClick={() => { setEditar(c); setOpen(true); }}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setBorrarId(c.id)}>
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        );
      },
    },
  ]);

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <SectionHeading as="h3">Categorías de gasto de administración</SectionHeading>
        <div className="flex gap-2">
          {sinDatos && (
            <Button variant="outline" size="sm" onClick={handleSeed}>
              Crear 6 categorías por defecto
            </Button>
          )}
          <Button size="sm" onClick={() => { setEditar(null); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Nueva
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {sinDatos ? (
            <p className="p-4 text-body-sm text-muted-foreground">
              Sin categorías. Crea las 6 por defecto (Nómina, Renta, Servicios, Marketing, Comisiones, Otros) o agrega manualmente.
            </p>
          ) : (
            <DataTable
              columns={columns}
              data={cats.data ?? []}
              rowKey={(c) => c.id}
              density={TABLE_DENSITY.embebida}
            />
          )}
        </CardContent>
      </Card>

      <DialogCategoria open={open} onOpenChange={setOpen} categoria={editar} />

      <ConfirmActionDialog
        open={!!borrarId}
        onOpenChange={(v) => { if (!v) setBorrarId(null); }}
        title="Eliminar categoría"
        variant="destructive"
        confirmLabel="Eliminar"
        onConfirm={handleEliminar}
        description="También se eliminarán los montos presupuestados asociados. Las facturas mantendrán su histórico sin categoría."
      />
    </div>
  );
}
