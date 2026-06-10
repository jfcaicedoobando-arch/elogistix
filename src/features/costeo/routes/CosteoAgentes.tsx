/**
 * Página: Agentes de costeo (proveedores chinos con días de crédito).
 * Captura mínima: nombre, días de crédito, contacto, email, activo.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { useCosteoAgentes, useCosteoAgenteMutations } from "@/features/costeo/hooks/useCosteoAgentes";
import type { CosteoAgenteInput } from "@/features/costeo/services/agentes";

const EMPTY: CosteoAgenteInput = {
  nombre: "",
  pais: "CN",
  dias_credito: 0,
  contacto_tarifario: "",
  email: "",
  activo: true,
};

export default function CosteoAgentes() {
  const { data: agentes = [], isLoading } = useCosteoAgentes();
  const { crear, eliminar } = useCosteoAgenteMutations();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CosteoAgenteInput>(EMPTY);

  const handleGuardar = async () => {
    if (!form.nombre.trim()) return;
    await crear.mutateAsync(form);
    setForm(EMPTY);
    setOpen(false);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Agentes de costeo</h1>
          <p className="text-sm text-muted-foreground">
            Proveedores que mandan tarifas marítimas. Los días de crédito se usan como criterio principal de desempate.
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
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && agentes.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Sin agentes registrados.
                </TableCell>
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
              <Label htmlFor="nombre">Nombre *</Label>
              <Input
                id="nombre"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="pais">País</Label>
                <Input
                  id="pais"
                  value={form.pais ?? "CN"}
                  onChange={(e) => setForm({ ...form, pais: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="dias">Días de crédito</Label>
                <Input
                  id="dias"
                  type="number"
                  min={0}
                  value={form.dias_credito}
                  onChange={(e) => setForm({ ...form, dias_credito: Number(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="contacto">Contacto</Label>
              <Input
                id="contacto"
                value={form.contacto_tarifario ?? ""}
                onChange={(e) => setForm({ ...form, contacto_tarifario: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email ?? ""}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="activo"
                checked={form.activo ?? true}
                onCheckedChange={(v) => setForm({ ...form, activo: v })}
              />
              <Label htmlFor="activo">Activo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleGuardar} disabled={crear.isPending || !form.nombre.trim()}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
