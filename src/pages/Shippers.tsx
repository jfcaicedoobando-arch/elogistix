import { useState } from "react";
import { Search, PackageCheck, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { shippers as shippersIniciales, embarques } from "@/data/mockData";
import { Shipper } from "@/data/types";

const emptyShipper = {
  nombre: "", pais: "", ciudad: "", direccion: "", contacto: "", email: "", telefono: "", notas: "",
};

export default function Shippers() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [shippersList, setShippersList] = useState<Shipper[]>(shippersIniciales);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyShipper);

  const filtered = shippersList.filter(s =>
    !search || s.nombre.toLowerCase().includes(search.toLowerCase()) || s.pais.toLowerCase().includes(search.toLowerCase())
  );

  const selectedShipper = shippersList.find(s => s.id === selected);
  const shipperEmbarques = embarques.filter(e => e.shipper.toLowerCase().includes(selectedShipper?.nombre.toLowerCase() ?? "---"));

  const handleChange = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSave = () => {
    if (!form.nombre.trim() || !form.pais.trim()) return;
    const nuevo: Shipper = { id: `S-${Date.now()}`, ...form };
    setShippersList(prev => [...prev, nuevo]);
    setForm(emptyShipper);
    setDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PackageCheck className="h-6 w-6 text-accent" />
          <h1 className="text-2xl font-bold">Shippers / Exportadores</h1>
        </div>
        <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-1" />Nuevo Shipper</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar por nombre o país..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>País</TableHead>
                    <TableHead>Ciudad</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Email</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(s => (
                    <TableRow key={s.id} className={`cursor-pointer ${selected === s.id ? 'bg-accent/10' : ''}`} onClick={() => setSelected(s.id)}>
                      <TableCell className="font-medium max-w-[200px] truncate">{s.nombre}</TableCell>
                      <TableCell className="text-xs">{s.pais}</TableCell>
                      <TableCell className="text-xs">{s.ciudad}</TableCell>
                      <TableCell className="text-xs">{s.contacto}</TableCell>
                      <TableCell className="text-xs">{s.email}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div>
          {selectedShipper ? (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">Detalle del Shipper</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="font-medium">{selectedShipper.nombre}</p>
                  <p className="text-muted-foreground">{selectedShipper.pais} · {selectedShipper.ciudad}</p>
                  <p className="text-muted-foreground">{selectedShipper.direccion}</p>
                  <div className="pt-2 border-t space-y-1">
                    <p><span className="text-muted-foreground">Contacto:</span> {selectedShipper.contacto}</p>
                    <p><span className="text-muted-foreground">Email:</span> {selectedShipper.email}</p>
                    <p><span className="text-muted-foreground">Tel:</span> {selectedShipper.telefono}</p>
                    {selectedShipper.notas && <p><span className="text-muted-foreground">Notas:</span> {selectedShipper.notas}</p>}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Embarques asociados</p>
                  <p className="text-xl font-bold">{shipperEmbarques.length}</p>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground text-sm">
                Selecciona un shipper para ver su detalle
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo Shipper / Exportador</DialogTitle>
            <DialogDescription>Ingresa los datos del shipper o exportador.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Nombre / Razón Social", field: "nombre", full: true, required: true },
              { label: "País", field: "pais", required: true },
              { label: "Ciudad", field: "ciudad" },
              { label: "Dirección", field: "direccion", full: true },
              { label: "Contacto", field: "contacto" },
              { label: "Email", field: "email" },
              { label: "Teléfono", field: "telefono" },
              { label: "Notas", field: "notas" },
            ].map(({ label, field, full, required }) => (
              <div key={field} className={full ? "col-span-2" : ""}>
                <Label className="text-xs">{label}{required && <span className="text-destructive ml-0.5">*</span>}</Label>
                <Input
                  value={(form as any)[field]}
                  onChange={(e) => handleChange(field, e.target.value)}
                  className="mt-1"
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.nombre.trim() || !form.pais.trim()}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
