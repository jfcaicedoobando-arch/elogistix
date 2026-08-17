import { useState } from "react";
import { notifyError } from "@/lib/ui/appFeedback";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { usePlanes, useUpdatePlan, type Plan } from "@/features/admin/hooks";
import { DataTable } from "@/components/shared/DataTable";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";
import { planEditSchema } from "./tabPlanesSchema";
import { buildPlanesColumns } from "./TabPlanesColumns";

export default function TabPlanes() {
  const { data: planes = [], isLoading } = usePlanes();
  const updatePlan = useUpdatePlan();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<Plan>>({});

  const startEdit = (plan: Plan) => {
    setEditingId(plan.id);
    setEditValues({
      max_usuarios: plan.max_usuarios,
      max_embarques_mes: plan.max_embarques_mes,
      almacenamiento_mb: plan.almacenamiento_mb,
      precio_mensual: plan.precio_mensual,
    });
  };

  const saveEdit = () => {
    if (!editingId) return;
    const parsed = planEditSchema.safeParse({
      max_usuarios: Number(editValues.max_usuarios),
      max_embarques_mes: Number(editValues.max_embarques_mes),
      almacenamiento_mb: Number(editValues.almacenamiento_mb),
      precio_mensual: Number(editValues.precio_mensual),
    });
    if (!parsed.success) {
      notifyError(undefined, {
        title: "Valores del plan inválidos",
        description:
          "Revisa los límites del plan: usuarios y embarques deben ser enteros mayores a 0; almacenamiento y precio no pueden ser negativos.",
        method: "FEATURES_ADMIN_COMPONENTS_TABPLANES_SAVE",
      });
      return;
    }
    updatePlan.mutate(
      { id: editingId, ...parsed.data },
      { onSuccess: () => setEditingId(null) }
    );
  };

  const columns = buildPlanesColumns({
    editingId,
    editValues,
    setEditValues,
    saveEdit,
    setEditingId,
    startEdit,
    updatePlan,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Planes y Límites</CardTitle>
        <CardDescription>Define los planes disponibles y sus límites para las organizaciones</CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={planes}
          isLoading={isLoading}
          emptyMessage="No hay planes configurados"
          rowKey={(p) => p.id}
          density={TABLE_DENSITY.listado}
        />
      </CardContent>
    </Card>
  );
}
