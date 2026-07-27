/**
 * Tab Configuración de categorías presupuestales.
 * v13.232.0 · Confirmación migrada a `ConfirmActionDialog` (Lote 7d.2).
 */
import { useState } from "react";
import { notifySuccess } from "@/lib/ui/appFeedback";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CardSkeleton } from "@/components/shared/skeletons";
import { ConfirmActionDialog } from "@/components/shared/dialogs/ConfirmActionDialog";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import {
  usePresupuestoCategorias, useEliminarCategoriaPresupuesto,
} from "@/features/presupuesto/hooks";
import { seedCategoriasDefault } from "@/features/presupuesto/services";
import type { CategoriaPresupuesto } from "@/features/presupuesto/services";
import { DialogCategoria } from "./DialogCategoria";

import { notifyError } from "@/lib/ui/appFeedback";
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
      const err = e as { message?: string };
      notifyError(undefined, { title: err.message ?? "Error", error: e, method: "FEATURES_PRESUPUESTO_COMPONENTS_TABCATEGORIAS_1" });
    }
  };

  const handleEliminar = async () => {
    if (!borrarId) return;
    try {
      await eliminar.mutateAsync(borrarId);
      notifySuccess(undefined, { title: "Categoría eliminada" });
      setBorrarId(null);
    } catch (e) {
      const err = e as { message?: string };
      notifyError(undefined, { title: err.message ?? "No se pudo eliminar", error: e, method: "FEATURES_PRESUPUESTO_COMPONENTS_TABCATEGORIAS_2" });
    }
  };

  if (cats.isLoading) return <CardSkeleton lines={6} />;
  const sinDatos = (cats.data ?? []).length === 0;

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold">Categorías de gasto de administración</h3>
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
            <p className="p-4 text-sm text-muted-foreground">
              Sin categorías. Crea las 6 por defecto (Nómina, Renta, Servicios, Marketing, Comisiones, Otros) o agrega manualmente.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Nombre</th>
                  <th className="px-3 py-2 text-left">Tipo contable</th>
                  <th className="px-3 py-2 text-right">Orden</th>
                  <th className="px-3 py-2">Activa</th>
                  <th className="px-3 py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {(cats.data ?? []).map((c, i) => {
                  const tipoLabel = c.tipo_contable === "CostoDirectoEmbarque" ? "Costos directos de embarque (COGS)"
                    : c.tipo_contable === "Venta" ? "Gastos de venta"
                    : "Gastos de administración";
                  const esGastoFijo = c.tipo_contable !== "CostoDirectoEmbarque";
                  return (
                    <tr key={c.id} className={`border-t ${i % 2 === 1 ? "bg-muted/20" : ""}`}>
                      <td className="px-3 py-2 font-medium">{c.nombre}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-block text-xs px-2 py-0.5 rounded ${esGastoFijo ? "bg-warning/10 text-warning-foreground" : "bg-muted text-muted-foreground"}`}>
                          {tipoLabel}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{c.orden}</td>
                      <td className="px-3 py-2 text-center">{c.activa ? "Sí" : "No"}</td>
                      <td className="px-3 py-2 text-right space-x-1">
                        <Button variant="ghost" size="sm" onClick={() => { setEditar(c); setOpen(true); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setBorrarId(c.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
