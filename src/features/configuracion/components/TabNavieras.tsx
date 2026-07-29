import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useAllNavieras, useAdminNavieras } from "@/features/catalogos/hooks";
import SearchInput from "@/components/shared/SearchInput";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { NavieraFormDialog } from "@/components/shared/NavieraFormDialog";
import type { Naviera } from "@/features/catalogos/services";

export default function TabNavieras() {
  const { data: navieras = [], isLoading } = useAllNavieras();
  const { agregarNaviera, toggleActivo, eliminarNaviera } = useAdminNavieras();
  const [busqueda, setBusqueda] = useState("");
  const [nuevoCode, setNuevoCode] = useState("");
  const [nuevoName, setNuevoName] = useState("");
  // Q-13/Q-12 (Ola 4): edición reutiliza el mismo `NavieraFormDialog` del
  // empty-state de `NavieraSelect` — un solo lugar cuida el fix de overlay.
  const [navieraEnEdicion, setNavieraEnEdicion] = useState<Naviera | null>(null);

  const handleAgregar = () => {
    if (!nuevoCode.trim() || !nuevoName.trim()) return;
    agregarNaviera.mutate(
      { code: nuevoCode.trim().toUpperCase(), name: nuevoName.trim() },
      { onSuccess: () => { setNuevoCode(""); setNuevoName(""); } }
    );
  };

  const filtradas = navieras.filter((n) => {
    if (!busqueda) return true;
    const q = busqueda.toLowerCase();
    return n.code.toLowerCase().includes(q) || n.name.toLowerCase().includes(q);
  });

  const columns: ColumnDef<Naviera, unknown>[] = defineColumns<Naviera>([
    { id: "code", header: "Código", meta: { className: "font-mono text-xs" }, cell: ({ row }) => row.original.code },
    { id: "name", header: "Nombre", cell: ({ row }) => row.original.name },
    {
      id: "activo", header: "Activo",
      meta: { className: "text-center", headerClassName: "text-center" },
      cell: ({ row }) => <Switch checked={row.original.activo} onCheckedChange={(checked) => toggleActivo.mutate({ id: row.original.id, activo: checked })} />,
    },
    {
      id: "acciones", header: "",
      meta: { headerClassName: "w-24" },
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setNavieraEnEdicion(row.original)} aria-label={`Editar naviera ${row.original.name}`}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => eliminarNaviera.mutate(row.original.id)} aria-label={`Eliminar naviera ${row.original.name}`}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Catálogo de Navieras</CardTitle>
        <CardDescription>Administra las líneas navieras disponibles en cotizaciones y embarques.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2 items-end">
          <div className="space-y-1">
            <Label className="text-xs">Código</Label>
            <Input className="w-28" placeholder="MAERSK" value={nuevoCode} onChange={(e) => setNuevoCode(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Nombre</Label>
            <Input className="w-64" placeholder="Maersk Line" value={nuevoName} onChange={(e) => setNuevoName(e.target.value)} />
          </div>
          <Button size="sm" onClick={handleAgregar} disabled={agregarNaviera.isPending}>
            <Plus className="h-4 w-4 mr-1" /> Agregar
          </Button>
        </div>

        <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar por código o nombre..." />

        <div className="max-h-[calc(100vh-20rem)] min-h-[320px] overflow-auto rounded-md border">
          <DataTable
            columns={columns}
            data={filtradas}
            isLoading={isLoading}
            emptyMessage="No se encontraron navieras"
            rowKey={(n) => n.id}
            rowClassName={(n) => !n.activo ? "opacity-50" : ""}
            density="compact"
          />
        </div>
        <p className="text-xs text-muted-foreground">{navieras.length} navieras en total · {navieras.filter(n => n.activo).length} activas</p>
      </CardContent>
      <NavieraFormDialog
        open={!!navieraEnEdicion}
        onOpenChange={(open) => { if (!open) setNavieraEnEdicion(null); }}
        naviera={navieraEnEdicion}
      />
    </Card>
  );
}
