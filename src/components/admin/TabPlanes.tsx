import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Save, Pencil } from "lucide-react";
import { usePlanes, useUpdatePlan, type Plan } from "@/hooks/admin";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { formatCurrency, formatNumber } from "@/lib/formatters";

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
    updatePlan.mutate(
      { id: editingId, ...editValues },
      { onSuccess: () => setEditingId(null) }
    );
  };

  const columns: ColumnDef<Plan, unknown>[] = defineColumns<Plan>([
    {
      id: "nombre",
      header: "Plan",
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div className="flex items-center gap-2">
            <span className="font-semibold capitalize">{p.nombre}</span>
            {!p.activo && <Badge variant="secondary">Inactivo</Badge>}
          </div>
        );
      },
    },
    {
      id: "max_usuarios",
      header: "Máx. Usuarios",
      meta: { className: "text-right tabular-nums" },
      cell: ({ row }) => {
        const p = row.original;
        return editingId === p.id ? (
          <Input
            type="number"
            className="w-20 text-right"
            value={editValues.max_usuarios ?? 0}
            onChange={(e) => setEditValues({ ...editValues, max_usuarios: Number(e.target.value) })}
          />
        ) : (
          formatNumber(p.max_usuarios)
        );
      },
    },
    {
      id: "max_embarques",
      header: "Máx. Embarques/Mes",
      meta: { className: "text-right tabular-nums" },
      cell: ({ row }) => {
        const p = row.original;
        return editingId === p.id ? (
          <Input
            type="number"
            className="w-24 text-right"
            value={editValues.max_embarques_mes ?? 0}
            onChange={(e) => setEditValues({ ...editValues, max_embarques_mes: Number(e.target.value) })}
          />
        ) : (
          formatNumber(p.max_embarques_mes)
        );
      },
    },
    {
      id: "almacenamiento",
      header: "Almacenamiento",
      meta: { className: "text-right tabular-nums" },
      cell: ({ row }) => {
        const p = row.original;
        return editingId === p.id ? (
          <Input
            type="number"
            className="w-24 text-right"
            value={editValues.almacenamiento_mb ?? 0}
            onChange={(e) => setEditValues({ ...editValues, almacenamiento_mb: Number(e.target.value) })}
          />
        ) : (
          formatNumber(p.almacenamiento_mb, { suffix: "MB" })
        );
      },
    },
    {
      id: "precio",
      header: "Precio/Mes",
      meta: { className: "text-right tabular-nums" },
      cell: ({ row }) => {
        const p = row.original;
        return editingId === p.id ? (
          <Input
            type="number"
            className="w-24 text-right"
            value={editValues.precio_mensual ?? 0}
            onChange={(e) => setEditValues({ ...editValues, precio_mensual: Number(e.target.value) })}
          />
        ) : (
          formatCurrency(Number(p.precio_mensual), "MXN")
        );
      },
    },
    {
      id: "activo",
      header: "Activo",
      meta: { headerClassName: "text-center", className: "text-center" },
      cell: ({ row }) => (
        <Switch
          checked={row.original.activo}
          onCheckedChange={(checked) => updatePlan.mutate({ id: row.original.id, activo: checked })}
        />
      ),
    },
    {
      id: "acciones",
      header: "",
      meta: { headerClassName: "w-20" },
      cell: ({ row }) => {
        const p = row.original;
        return editingId === p.id ? (
          <div className="flex gap-1">
            <Button size="sm" onClick={saveEdit} disabled={updatePlan.isPending}>
              <Save className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
              ✕
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => startEdit(p)}>
            <Pencil className="h-3 w-3" />
          </Button>
        );
      },
    },
  ]);

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
          density="comfortable"
        />
      </CardContent>
    </Card>
  );
}
