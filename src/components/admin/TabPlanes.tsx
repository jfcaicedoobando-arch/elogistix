import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Save, Pencil } from "lucide-react";
import { usePlanes, useUpdatePlan, type Plan } from "@/hooks/admin/usePlanes";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
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

  const columns: DataTableColumn<Plan>[] = [
    {
      key: "nombre",
      header: "Plan",
      render: (p) => (
        <div className="flex items-center gap-2">
          <span className="font-semibold capitalize">{p.nombre}</span>
          {!p.activo && <Badge variant="secondary">Inactivo</Badge>}
        </div>
      ),
    },
    {
      key: "max_usuarios",
      header: "Máx. Usuarios",
      className: "text-right tabular-nums",
      render: (p) =>
        editingId === p.id ? (
          <Input
            type="number"
            className="w-20 text-right"
            value={editValues.max_usuarios ?? 0}
            onChange={(e) => setEditValues({ ...editValues, max_usuarios: Number(e.target.value) })}
          />
        ) : (
          p.max_usuarios.toLocaleString("es-MX")
        ),
    },
    {
      key: "max_embarques",
      header: "Máx. Embarques/Mes",
      className: "text-right",
      render: (p) =>
        editingId === p.id ? (
          <Input
            type="number"
            className="w-24 text-right"
            value={editValues.max_embarques_mes ?? 0}
            onChange={(e) => setEditValues({ ...editValues, max_embarques_mes: Number(e.target.value) })}
          />
        ) : (
          p.max_embarques_mes.toLocaleString("es-MX")
        ),
    },
    {
      key: "almacenamiento",
      header: "Almacenamiento (MB)",
      className: "text-right",
      render: (p) =>
        editingId === p.id ? (
          <Input
            type="number"
            className="w-24 text-right"
            value={editValues.almacenamiento_mb ?? 0}
            onChange={(e) => setEditValues({ ...editValues, almacenamiento_mb: Number(e.target.value) })}
          />
        ) : (
          p.almacenamiento_mb.toLocaleString("es-MX")
        ),
    },
    {
      key: "precio",
      header: "Precio/Mes",
      className: "text-right",
      render: (p) =>
        editingId === p.id ? (
          <Input
            type="number"
            className="w-24 text-right"
            value={editValues.precio_mensual ?? 0}
            onChange={(e) => setEditValues({ ...editValues, precio_mensual: Number(e.target.value) })}
          />
        ) : (
          `$${Number(p.precio_mensual).toLocaleString("es-MX")}`
        ),
    },
    {
      key: "activo",
      header: "Activo",
      headerClassName: "text-center",
      className: "text-center",
      render: (p) => (
        <Switch
          checked={p.activo}
          onCheckedChange={(checked) => updatePlan.mutate({ id: p.id, activo: checked })}
        />
      ),
    },
    {
      key: "acciones",
      header: "",
      headerClassName: "w-20",
      render: (p) =>
        editingId === p.id ? (
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
        ),
    },
  ];

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
        />
      </CardContent>
    </Card>
  );
}
