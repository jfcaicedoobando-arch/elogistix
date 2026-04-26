import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2 } from "lucide-react";
import { useAllNavieras, useAdminNavieras } from "@/hooks/catalogos/useNavieras";
import SearchInput from "@/components/selects/SearchInput";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";

type Naviera = { id: string; code: string; name: string; activo: boolean };

export default function TabNavieras() {
  const { data: navieras = [], isLoading } = useAllNavieras();
  const { agregarNaviera, toggleActivo, eliminarNaviera } = useAdminNavieras();
  const [busqueda, setBusqueda] = useState("");
  const [nuevoCode, setNuevoCode] = useState("");
  const [nuevoName, setNuevoName] = useState("");

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

  const columns: DataTableColumn<Naviera>[] = [
    { key: "code", header: "Código", className: "font-mono text-xs", render: (n) => n.code },
    { key: "name", header: "Nombre", render: (n) => n.name },
    {
      key: "activo", header: "Activo", headerClassName: "text-center", className: "text-center",
      render: (n) => <Switch checked={n.activo} onCheckedChange={(checked) => toggleActivo.mutate({ id: n.id, activo: checked })} />,
    },
    {
      key: "eliminar", header: "", headerClassName: "w-12",
      render: (n) => (
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => eliminarNaviera.mutate(n.id)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      ),
    },
  ];

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

        <div className="max-h-[500px] overflow-auto rounded-md border">
          <DataTable
            columns={columns}
            data={filtradas}
            isLoading={isLoading}
            emptyMessage="No se encontraron navieras"
            rowKey={(n) => n.id}
            rowClassName={(n) => !n.activo ? "opacity-50" : ""}
          />
        </div>
        <p className="text-xs text-muted-foreground">{navieras.length} navieras en total · {navieras.filter(n => n.activo).length} activas</p>
      </CardContent>
    </Card>
  );
}
