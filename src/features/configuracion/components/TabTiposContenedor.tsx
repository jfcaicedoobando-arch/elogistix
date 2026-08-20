import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/shared/FormField";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2 } from "lucide-react";
import { useAllTiposContenedor, useAdminTiposContenedor } from "@/features/catalogos/hooks";
import SearchInput from "@/components/shared/SearchInput";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";
import { DeleteConfirmDialog } from "@/components/shared/dialogs/DeleteConfirmDialog";
import { usePermissions } from "@/hooks/shared";

type TipoContenedor = { id: string; code: string; name: string; activo: boolean };

export default function TabTiposContenedor() {
  const { data: tipos = [], isLoading } = useAllTiposContenedor();
  const { agregarTipo, toggleActivo, eliminarTipo } = useAdminTiposContenedor();
  const { canAdminTenant } = usePermissions();
  const [busqueda, setBusqueda] = useState("");
  const [nuevoCode, setNuevoCode] = useState("");
  const [nuevoName, setNuevoName] = useState("");
  // UX-01/UIA-05: eliminar exige confirmación de doble paso y sólo se ofrece
  // a quien puede administrar el tenant.
  const [tipoAEliminar, setTipoAEliminar] = useState<TipoContenedor | null>(null);

  const handleAgregar = () => {
    if (!nuevoCode.trim() || !nuevoName.trim()) return;
    agregarTipo.mutate(
      { code: nuevoCode.trim().toUpperCase(), name: nuevoName.trim() },
      { onSuccess: () => { setNuevoCode(""); setNuevoName(""); } }
    );
  };

  const filtrados = tipos.filter((t) => {
    if (!busqueda) return true;
    const q = busqueda.toLowerCase();
    return t.code.toLowerCase().includes(q) || t.name.toLowerCase().includes(q);
  });

  const columns: ColumnDef<TipoContenedor, unknown>[] = defineColumns<TipoContenedor>([
    { id: "code", header: "Código", meta: { className: "font-mono text-xs" }, cell: ({ row }) => row.original.code },
    { id: "name", header: "Nombre", cell: ({ row }) => row.original.name },
    {
      id: "activo", header: "Activo",
      meta: { className: "text-center", headerClassName: "text-center" },
      cell: ({ row }) => <Switch checked={row.original.activo} onCheckedChange={(checked) => toggleActivo.mutate({ id: row.original.id, activo: checked })} aria-label={row.original.activo ? `Desactivar tipo de contenedor ${row.original.name}` : `Activar tipo de contenedor ${row.original.name}`} />,
    },
    {
      id: "eliminar", header: "",
      meta: { headerClassName: "w-12" },
      cell: ({ row }) =>
        canAdminTenant ? (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" disabled={eliminarTipo.isPending} onClick={() => setTipoAEliminar(row.original)} aria-label={`Eliminar tipo ${row.original.name}`}>
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : null,
    },
  ]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tipos de Contenedor</CardTitle>
        <CardDescription>Administra los tipos de contenedor disponibles en el sistema.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2 items-end">
          <FormField label="Código" className="space-y-1">
            <Input className="w-28" placeholder="40HC" value={nuevoCode} onChange={(e) => setNuevoCode(e.target.value)} />
          </FormField>
          <FormField label="Nombre" className="space-y-1">
            <Input className="w-64" placeholder="40' High Cube" value={nuevoName} onChange={(e) => setNuevoName(e.target.value)} />
          </FormField>
          <Button size="sm" onClick={handleAgregar} disabled={agregarTipo.isPending}>
            <Plus className="h-4 w-4 mr-1" /> Agregar
          </Button>
        </div>

        <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar por código o nombre…" />

        <div className="max-h-[calc(100vh-20rem)] min-h-[320px] overflow-auto rounded-md border">
          <DataTable
            columns={columns}
            data={filtrados}
            isLoading={isLoading}
            emptyMessage="No se encontraron tipos de contenedor"
            rowKey={(t) => t.id}
            rowClassName={(t) => !t.activo ? "opacity-50" : ""}
            density={TABLE_DENSITY.embebida}
          />
        </div>
        <p className="text-xs text-muted-foreground">{tipos.length} tipos en total · {tipos.filter(t => t.activo).length} activos</p>
      </CardContent>
      <DeleteConfirmDialog
        open={!!tipoAEliminar}
        onOpenChange={(open) => { if (!open) setTipoAEliminar(null); }}
        entityName={tipoAEliminar ? `el tipo de contenedor "${tipoAEliminar.name}"` : "este tipo de contenedor"}
        description="El tipo de contenedor dejará de estar disponible en cotizaciones y embarques nuevos."
        isPending={eliminarTipo.isPending}
        onConfirm={() => {
          if (tipoAEliminar) eliminarTipo.mutate(tipoAEliminar.id);
        }}
      />
    </Card>
  );
}
