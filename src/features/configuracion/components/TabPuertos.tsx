import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2 } from "lucide-react";
import { useAllPuertos, useAdminPuertos } from "@/features/catalogos/hooks";
import SearchInput from "@/components/shared/SearchInput";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";
import { DeleteConfirmDialog } from "@/components/shared/dialogs/DeleteConfirmDialog";
import { usePermissions } from "@/hooks/shared";

type Puerto = { id: string; code: string; name: string; country: string; activo: boolean };

export default function TabPuertos() {
  const { data: puertos = [], isLoading: puertosLoading } = useAllPuertos();
  const { agregarPuerto, toggleActivo, eliminarPuerto } = useAdminPuertos();
  const { canAdminTenant } = usePermissions();
  const [puertoBusqueda, setPuertoBusqueda] = useState("");
  const [nuevoCode, setNuevoCode] = useState("");
  const [nuevoName, setNuevoName] = useState("");
  const [nuevoCountry, setNuevoCountry] = useState("");
  // UX-01/UIA-05: eliminar exige confirmación de doble paso y sólo se ofrece
  // a quien puede administrar el tenant.
  const [puertoAEliminar, setPuertoAEliminar] = useState<Puerto | null>(null);

  const handleAgregarPuerto = () => {
    if (!nuevoCode.trim() || !nuevoName.trim() || !nuevoCountry.trim()) return;
    agregarPuerto.mutate(
      { code: nuevoCode.trim().toUpperCase(), name: nuevoName.trim(), country: nuevoCountry.trim() },
      { onSuccess: () => { setNuevoCode(""); setNuevoName(""); setNuevoCountry(""); } }
    );
  };

  const puertosFiltrados = puertos.filter((p) => {
    if (!puertoBusqueda) return true;
    const q = puertoBusqueda.toLowerCase();
    return p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || p.country.toLowerCase().includes(q);
  });

  const columns: ColumnDef<Puerto, unknown>[] = defineColumns<Puerto>([
    { id: "code", header: "Código", meta: { className: "font-mono text-xs" }, cell: ({ row }) => row.original.code },
    { id: "name", header: "Nombre", cell: ({ row }) => row.original.name },
    { id: "country", header: "País", cell: ({ row }) => row.original.country },
    {
      id: "activo", header: "Activo",
      meta: { className: "text-center", headerClassName: "text-center" },
      cell: ({ row }) => <Switch checked={row.original.activo} onCheckedChange={(checked) => toggleActivo.mutate({ id: row.original.id, activo: checked })} aria-label={row.original.activo ? `Desactivar puerto ${row.original.name}` : `Activar puerto ${row.original.name}`} />,
    },
    {
      id: "eliminar", header: "",
      meta: { headerClassName: "w-12" },
      // UIA-05: el botón sólo se ofrece a quien sí tiene permiso de borrado
      // (antes el usuario lo descubría con un toast de error tras el clic).
      cell: ({ row }) =>
        canAdminTenant ? (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" disabled={eliminarPuerto.isPending} onClick={() => setPuertoAEliminar(row.original)} aria-label={`Eliminar puerto ${row.original.name}`}>
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : null,
    },
  ]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Catálogo de Puertos</CardTitle>
        <CardDescription>Administra los puertos disponibles en cotizaciones y embarques. Desactiva los que no uses.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2 items-end">
          <div className="space-y-1">
            <Label className="text-xs">Código</Label>
            <Input className="w-28" placeholder="MXZLO" value={nuevoCode} onChange={(e) => setNuevoCode(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Nombre</Label>
            <Input className="w-48" placeholder="Manzanillo" value={nuevoName} onChange={(e) => setNuevoName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">País</Label>
            <Input className="w-40" placeholder="México" value={nuevoCountry} onChange={(e) => setNuevoCountry(e.target.value)} />
          </div>
          <Button size="sm" onClick={handleAgregarPuerto} disabled={agregarPuerto.isPending}>
            <Plus className="h-4 w-4 mr-1" /> Agregar
          </Button>
        </div>

        <SearchInput value={puertoBusqueda} onChange={setPuertoBusqueda} placeholder="Buscar por código, nombre o país..." />

        <div className="max-h-[calc(100vh-20rem)] min-h-[320px] overflow-auto rounded-md border">
          <DataTable
            columns={columns}
            data={puertosFiltrados}
            isLoading={puertosLoading}
            emptyMessage="No se encontraron puertos"
            rowKey={(p) => p.id}
            rowClassName={(p) => !p.activo ? "opacity-50" : ""}
            density={TABLE_DENSITY.embebida}
          />
        </div>
        <p className="text-xs text-muted-foreground">{puertos.length} puertos en total · {puertos.filter(p => p.activo).length} activos</p>
      </CardContent>
      <DeleteConfirmDialog
        open={!!puertoAEliminar}
        onOpenChange={(open) => { if (!open) setPuertoAEliminar(null); }}
        entityName={puertoAEliminar ? `el puerto "${puertoAEliminar.name}"` : "este puerto"}
        description="El puerto dejará de estar disponible en cotizaciones y embarques nuevos."
        isPending={eliminarPuerto.isPending}
        onConfirm={() => {
          if (puertoAEliminar) eliminarPuerto.mutate(puertoAEliminar.id);
        }}
      />
    </Card>
  );
}
