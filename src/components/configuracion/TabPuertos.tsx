import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2 } from "lucide-react";
import { useAllPuertos, useAdminPuertos } from "@/hooks/usePuertos";
import SearchInput from "@/components/SearchInput";
import { DataTable, type DataTableColumn } from "@/components/DataTable";

type Puerto = { id: string; code: string; name: string; country: string; activo: boolean };

export default function TabPuertos() {
  const { data: puertos = [], isLoading: puertosLoading } = useAllPuertos();
  const { agregarPuerto, toggleActivo, eliminarPuerto } = useAdminPuertos();
  const [puertoBusqueda, setPuertoBusqueda] = useState("");
  const [nuevoCode, setNuevoCode] = useState("");
  const [nuevoName, setNuevoName] = useState("");
  const [nuevoCountry, setNuevoCountry] = useState("");

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

  const columns: DataTableColumn<Puerto>[] = [
    { key: "code", header: "Código", className: "font-mono text-xs", render: (p) => p.code },
    { key: "name", header: "Nombre", render: (p) => p.name },
    { key: "country", header: "País", render: (p) => p.country },
    {
      key: "activo", header: "Activo", headerClassName: "text-center", className: "text-center",
      render: (p) => <Switch checked={p.activo} onCheckedChange={(checked) => toggleActivo.mutate({ id: p.id, activo: checked })} />,
    },
    {
      key: "eliminar", header: "", headerClassName: "w-12",
      render: (p) => (
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => eliminarPuerto.mutate(p.id)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      ),
    },
  ];

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

        <div className="max-h-[500px] overflow-auto rounded-md border">
          <DataTable
            columns={columns}
            data={puertosFiltrados}
            isLoading={puertosLoading}
            emptyMessage="No se encontraron puertos"
            rowKey={(p) => p.id}
            rowClassName={(p) => !p.activo ? "opacity-50" : ""}
          />
        </div>
        <p className="text-xs text-muted-foreground">{puertos.length} puertos en total · {puertos.filter(p => p.activo).length} activos</p>
      </CardContent>
    </Card>
  );
}
