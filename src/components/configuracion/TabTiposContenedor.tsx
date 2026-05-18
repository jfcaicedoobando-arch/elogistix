import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2 } from "lucide-react";
import { useAllTiposContenedor, useAdminTiposContenedor } from "@/hooks/catalogos";
import SearchInput from "@/components/selects/SearchInput";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";

type TipoContenedor = { id: string; code: string; name: string; activo: boolean };

export default function TabTiposContenedor() {
  const { data: tipos = [], isLoading } = useAllTiposContenedor();
  const { agregarTipo, toggleActivo, eliminarTipo } = useAdminTiposContenedor();
  const [busqueda, setBusqueda] = useState("");
  const [nuevoCode, setNuevoCode] = useState("");
  const [nuevoName, setNuevoName] = useState("");

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

  const columns: DataTableColumn<TipoContenedor>[] = [
    { key: "code", header: "Código", className: "font-mono text-xs", render: (t) => t.code },
    { key: "name", header: "Nombre", render: (t) => t.name },
    {
      key: "activo", header: "Activo", headerClassName: "text-center", className: "text-center",
      render: (t) => <Switch checked={t.activo} onCheckedChange={(checked) => toggleActivo.mutate({ id: t.id, activo: checked })} />,
    },
    {
      key: "eliminar", header: "", headerClassName: "w-12",
      render: (t) => (
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => eliminarTipo.mutate(t.id)} aria-label={`Eliminar tipo ${t.name}`}>
          <Trash2 className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tipos de Contenedor</CardTitle>
        <CardDescription>Administra los tipos de contenedor disponibles en el sistema.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2 items-end">
          <div className="space-y-1">
            <Label className="text-xs">Código</Label>
            <Input className="w-28" placeholder="40HC" value={nuevoCode} onChange={(e) => setNuevoCode(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Nombre</Label>
            <Input className="w-64" placeholder="40' High Cube" value={nuevoName} onChange={(e) => setNuevoName(e.target.value)} />
          </div>
          <Button size="sm" onClick={handleAgregar} disabled={agregarTipo.isPending}>
            <Plus className="h-4 w-4 mr-1" /> Agregar
          </Button>
        </div>

        <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar por código o nombre..." />

        <div className="max-h-[500px] overflow-auto rounded-md border">
          <DataTable
            columns={columns}
            data={filtrados}
            isLoading={isLoading}
            emptyMessage="No se encontraron tipos de contenedor"
            rowKey={(t) => t.id}
            rowClassName={(t) => !t.activo ? "opacity-50" : ""}
            density="compact"
          />
        </div>
        <p className="text-xs text-muted-foreground">{tipos.length} tipos en total · {tipos.filter(t => t.activo).length} activos</p>
      </CardContent>
    </Card>
  );
}
