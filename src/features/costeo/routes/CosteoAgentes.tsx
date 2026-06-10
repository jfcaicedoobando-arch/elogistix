/**
 * Página: Agentes de costeo (forwarders chinos vinculados a Proveedores).
 * Vínculo obligatorio a un proveedor tipo "Agente de Carga".
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { useCosteoAgentes, useCosteoAgenteMutations } from "@/features/costeo/hooks/useCosteoAgentes";
import { useProveedoresAgente } from "@/features/costeo/hooks/useNavieraCondiciones";
import type { CosteoAgenteInput } from "@/features/costeo/services/agentes";

const EMPTY: CosteoAgenteInput = {
  nombre: "",
  proveedor_id: "",
  pais: "CN",
  dias_credito: 0,
  contacto_tarifario: "",
  email: "",
  activo: true,
};

export default function CosteoAgentes() {
  const { data: agentes = [], isLoading } = useCosteoAgentes();
  const { crear, eliminar } = useCosteoAgenteMutations();
  const { data: proveedores = [] } = useProveedoresAgente();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CosteoAgenteInput>(EMPTY);

  const handleGuardar = async () => {
    if (!form.nombre.trim() || !form.proveedor_id) return;
    await crear.mutateAsync(form);
    setForm(EMPTY);
    setOpen(false);
  };

  const valido = form.nombre.trim().length > 0 && form.proveedor_id.length > 0;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Agentes de costeo</h1>
          <p className="text-sm text-muted-foreground">
            Forwarders chinos vinculados al directorio de Proveedores. Los días de crédito se usan como criterio principal de desempate.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4 mr-2" />
          Nuevo agente
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>País</TableHead>
              <TableHead className="text-right">Días crédito</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Activo</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">Cargando…</TableCell>
              </TableRow>
            )}
            {!isLoading && agentes.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">Sin agentes registrados.</TableCell>
              </TableRow>
            )}
            {agentes.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.nombre}</TableCell>
                <TableCell>{a.pais}</TableCell>
                <TableCell className="text-right">{a.dias_credito}</TableCell>
                <TableCell>{a.contacto_tarifario ?? "—"}</TableCell>
                <TableCell>{a.email ?? "—"}</TableCell>
                <TableCell>{a.activo ? "Sí" : "No"}</TableCell>
                <TableCell>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`¿Eliminar agente "${a.nombre}"?`)) eliminar.mutate(a.id);
                    }}
                    aria-label="Eliminar agente"
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo agente</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="proveedor">Proveedor (Agente de Carga) *</Label>
              <Select
                value={form.proveedor_id}
                onValueChange={(v) => {
                  const p = proveedores.find((x) => x.id === v);
                  setForm({
                    ...form,
                    proveedor_id: v,
                    nombre: form.nombre || (p?.nombre ?? ""),
                    pais: p?.pais || form.pais,
                  });
                }}
              >
                <SelectTrigger><SelectValue placeholder="Selecciona proveedor" /></SelectTrigger>
                <SelectContent>
                  {proveedores.length === 0 && (
                    <SelectItem value="__empty" disabled>
                      Sin proveedores tipo "Agente de Carga". Créalos en Directorio → Proveedores.
                    </SelectItem>
                  )}
                  {proveedores.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nombre} {p.pais ? `· ${p.pais}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="nombre">Nombre comercial *</Label>
              <Input id="nombre" value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="pais">País</Label>
                <Input id="pais" value={form.pais ?? "CN"}
                  onChange={(e) => setForm({ ...form, pais: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="dias">Días de crédito</Label>
                <Input id="dias" type="number" min={0} value={form.dias_credito}
                  onChange={(e) => setForm({ ...form, dias_credito: Number(e.target.value) || 0 })} />
              </div>
            </div>
            <div>
              <Label htmlFor="contacto">Contacto</Label>
              <Input id="contacto" value={form.contacto_tarifario ?? ""}
                onChange={(e) => setForm({ ...form, contacto_tarifario: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email ?? ""}
                onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <Switch id="activo" checked={form.activo ?? true}
                onCheckedChange={(v) => setForm({ ...form, activo: v })} />
              <Label htmlFor="activo">Activo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleGuardar} disabled={crear.isPending || !valido}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
