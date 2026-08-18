/**
 * Definición de columnas de la tabla de planes. Extraído de `TabPlanes.tsx`
 * (Power of 10: máx. 200 líneas por archivo).
 */
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Save, Pencil } from "lucide-react";
import type { Plan, useUpdatePlan } from "@/features/admin/hooks";
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { formatCurrency, formatNumber } from "@/lib/formatters";

interface BuildColumnsArgs {
  editingId: string | null;
  editValues: Partial<Plan>;
  setEditValues: (v: Partial<Plan>) => void;
  saveEdit: () => void;
  setEditingId: (id: string | null) => void;
  startEdit: (plan: Plan) => void;
  updatePlan: ReturnType<typeof useUpdatePlan>;
}

export function buildPlanesColumns({
  editingId,
  editValues,
  setEditValues,
  saveEdit,
  setEditingId,
  startEdit,
  updatePlan,
}: BuildColumnsArgs): ColumnDef<Plan, unknown>[] {
  return defineColumns<Plan>([
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
            aria-label="Máx. usuarios"
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
            aria-label="Máx. embarques por mes"
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
            aria-label="Almacenamiento (MB)"
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
            aria-label="Precio mensual"
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
          aria-label={row.original.activo ? `Desactivar plan ${row.original.nombre}` : `Activar plan ${row.original.nombre}`}
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
            <Button size="sm" onClick={saveEdit} disabled={updatePlan.isPending} aria-label="Guardar plan">
              <Save className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} aria-label="Cancelar edición">
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
}
