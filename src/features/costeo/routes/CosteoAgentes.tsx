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
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Pencil } from "lucide-react";
import { useCosteoAgentes, useCosteoAgenteMutations } from "@/features/costeo/hooks/useCosteoAgentes";
import { useProveedoresAgente } from "@/features/costeo/hooks/useNavieraCondiciones";
import type { CosteoAgenteInput } from "@/features/costeo/services/agentes";
import { PageHeader } from "@/components/shared/PageHeader";
import { ConfirmDeleteAlert } from "@/features/costeo/components/ConfirmDeleteAlert";

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
  const [aEliminar, setAEliminar] = useState<{ id: string; nombre: string } | null>(null);
  const [intentoEnvio, setIntentoEnvio] = useState(false);

  const valido = form.nombre.trim().length > 0 && form.proveedor_id.length > 0;

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setIntentoEnvio(true);
    if (!valido) return;
    await crear.mutateAsync(form);
    setForm(EMPTY);
    setIntentoEnvio(false);
    setOpen(false);
  };

  const proveedorInvalido = intentoEnvio && !form.proveedor_id;
  const nombreInvalido = intentoEnvio && !form.nombre.trim();

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Agentes de costeo"
        description="Forwarders chinos vinculados al directorio de Proveedores. Los días de crédito se usan como criterio principal de desempate."
        actions={<Button onClick={() => { setIntentoEnvio(false); setOpen(true); }}>
          <Plus className="size-4 mr-2" />
          Nuevo agente
        </Button>}
      />

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
                    onClick={() => setAEliminar({ id: a.id, nombre: a.nombre })}
                    aria-label={`Eliminar agente ${a.nombre}`}
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
            <DialogDescription>Registra un nuevo agente de carga con sus datos de contacto.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleGuardar} className="space-y-3">
            <div>
              <Label htmlFor="agente-proveedor">Proveedor (Agente de Carga) *</Label>
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
                <SelectTrigger
                  id="agente-proveedor"
                  aria-invalid={proveedorInvalido || undefined}
                  className={proveedorInvalido ? "border-destructive" : undefined}
                >
                  <SelectValue placeholder="Selecciona proveedor" />
                </SelectTrigger>
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
              <Label htmlFor="agente-nombre">Nombre comercial *</Label>
              <Input
                id="agente-nombre"
                value={form.nombre}
                aria-invalid={nombreInvalido || undefined}
                className={nombreInvalido ? "border-destructive" : undefined}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="agente-pais">País</Label>
                <Input id="agente-pais" value={form.pais ?? "CN"}
                  onChange={(e) => setForm({ ...form, pais: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="agente-dias">Días de crédito</Label>
                <Input id="agente-dias" type="number" min={0} value={form.dias_credito}
                  onChange={(e) => setForm({ ...form, dias_credito: Number(e.target.value) || 0 })} />
              </div>
            </div>
            <div>
              <Label htmlFor="agente-contacto">Contacto</Label>
              <Input id="agente-contacto" value={form.contacto_tarifario ?? ""}
                onChange={(e) => setForm({ ...form, contacto_tarifario: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="agente-email">Email</Label>
              <Input id="agente-email" type="email" value={form.email ?? ""}
                onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <Switch id="agente-activo" checked={form.activo ?? true}
                onCheckedChange={(v) => setForm({ ...form, activo: v })} />
              <Label htmlFor="agente-activo">Activo</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={crear.isPending}>
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteAlert
        open={!!aEliminar}
        onOpenChange={(o) => !o && setAEliminar(null)}
        title={aEliminar ? `¿Eliminar agente "${aEliminar.nombre}"?` : ""}
        description="Esta acción no se puede deshacer."
        pending={eliminar.isPending}
        onConfirm={() => {
          if (aEliminar) {
            eliminar.mutate(aEliminar.id, { onSuccess: () => setAEliminar(null) });
          }
        }}
      />
    </div>
  );
}
