import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2 } from "lucide-react";
import { useAllPuertos, useAdminPuertos } from "@/hooks/usePuertos";
import SearchInput from "@/components/SearchInput";

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

        {puertosLoading ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : (
          <div className="max-h-[500px] overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>País</TableHead>
                  <TableHead className="text-center">Activo</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {puertosFiltrados.map((p) => (
                  <TableRow key={p.id} className={!p.activo ? "opacity-50" : ""}>
                    <TableCell className="font-mono text-xs">{p.code}</TableCell>
                    <TableCell>{p.name}</TableCell>
                    <TableCell>{p.country}</TableCell>
                    <TableCell className="text-center">
                      <Switch checked={p.activo} onCheckedChange={(checked) => toggleActivo.mutate({ id: p.id, activo: checked })} />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => eliminarPuerto.mutate(p.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {puertosFiltrados.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No se encontraron puertos</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
        <p className="text-xs text-muted-foreground">{puertos.length} puertos en total · {puertos.filter(p => p.activo).length} activos</p>
      </CardContent>
    </Card>
  );
}
