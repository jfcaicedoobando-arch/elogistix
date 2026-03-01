import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Truck, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useProveedores } from "@/hooks/useProveedores";
import NuevoProveedorDialog from "@/components/NuevoProveedorDialog";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";
import type { TipoProveedor, Proveedor } from "@/data/types";

const TABS: { label: string; tipo: TipoProveedor }[] = [
  { label: 'Navieras', tipo: 'Naviera' },
  { label: 'Aerolíneas', tipo: 'Aerolínea' },
  { label: 'Transportistas', tipo: 'Transportista' },
  { label: 'Agentes Aduanales', tipo: 'Agente Aduanal' },
  { label: 'Agentes de Carga', tipo: 'Agente de Carga' },
  { label: 'Aseguradoras', tipo: 'Aseguradora' },
  { label: 'Custodia', tipo: 'Custodia' },
  { label: 'Almacenes', tipo: 'Almacenes' },
  { label: 'Acondicionamiento', tipo: 'Acondicionamiento de Carga' },
  { label: 'Mat. Peligrosos', tipo: 'Materiales Peligrosos' },
];

function ProveedorTable({ tipo, search, onSelect, proveedores, isLoading }: { tipo: TipoProveedor; search: string; onSelect: (id: string) => void; proveedores: Proveedor[]; isLoading: boolean }) {
  const filtered = proveedores.filter(p => p.tipo === tipo && (!search || p.nombre.toLowerCase().includes(search.toLowerCase())));

  if (isLoading) {
    return <Card><CardContent className="p-6 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</CardContent></Card>;
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>RFC</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead>Moneda</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length > 0 ? filtered.map(p => (
              <TableRow key={p.id} className="cursor-pointer" onClick={() => onSelect(p.id)}>
                <TableCell className="font-medium">{p.nombre}</TableCell>
                <TableCell className="text-xs font-mono">{p.rfc}</TableCell>
                <TableCell className="text-xs">{p.contacto}</TableCell>
                <TableCell className="text-xs">{p.moneda_preferida}</TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">Sin proveedores registrados</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default function Proveedores() {
  const [search, setSearch] = useState("");
  const [nuevoOpen, setNuevoOpen] = useState(false);
  const navigate = useNavigate();
  const { proveedores, addProveedor, isLoading } = useProveedores();
  const { canEdit } = usePermissions();

  const handleAdd = async (data: Omit<Proveedor, 'id'>) => {
    try {
      await addProveedor(data);
      toast.success("Proveedor creado correctamente");
    } catch {
      toast.error("Error al crear proveedor");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Truck className="h-6 w-6 text-accent" />
          <h1 className="text-2xl font-bold">Proveedores</h1>
        </div>
        {canEdit && (
          <Button onClick={() => setNuevoOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Nuevo Proveedor
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar proveedor..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="Naviera">
        <TabsList className="w-full flex flex-wrap h-auto gap-1">
          {TABS.map(t => (
            <TabsTrigger key={t.tipo} value={t.tipo} className="text-xs">{t.label}</TabsTrigger>
          ))}
        </TabsList>
        {TABS.map(t => (
          <TabsContent key={t.tipo} value={t.tipo}>
            <ProveedorTable tipo={t.tipo} search={search} onSelect={(id) => navigate(`/proveedores/${id}`)} proveedores={proveedores} isLoading={isLoading} />
          </TabsContent>
        ))}
      </Tabs>

      <NuevoProveedorDialog open={nuevoOpen} onOpenChange={setNuevoOpen} onSave={handleAdd} />
    </div>
  );
}
