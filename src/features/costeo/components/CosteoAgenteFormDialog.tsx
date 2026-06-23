/**
 * Diálogo de alta/edición de Agente de costeo.
 * Migrado a FormDialogShell (Ola 2 — Costeo).
 */
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import type { CosteoAgenteInput } from "@/features/costeo/services/agentes";

interface ProveedorAgente {
  id: string;
  nombre: string;
  pais: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editando: boolean;
  form: CosteoAgenteInput;
  setForm: (f: CosteoAgenteInput) => void;
  proveedores: ProveedorAgente[];
  intentoEnvio: boolean;
  isPending: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export function CosteoAgenteFormDialog({
  open, onOpenChange, editando, form, setForm, proveedores, intentoEnvio, isPending, onSubmit,
}: Props) {
  const proveedorInvalido = intentoEnvio && !form.proveedor_id;
  const nombreInvalido = intentoEnvio && !form.nombre.trim();

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Users}
      title={editando ? "Editar agente" : "Nuevo agente"}
      description={
        editando
          ? "Modifica los datos del agente de carga."
          : "Registra un nuevo agente de carga con sus datos de contacto."
      }
      size="xl"
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="agente-form" disabled={isPending}>
            {editando ? "Actualizar" : "Guardar"}
          </Button>
        </>
      }
    >
      <form id="agente-form" onSubmit={onSubmit} className="space-y-4">
        <FormDialogSection cols={1} flat>
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
        </FormDialogSection>

        <FormDialogSection cols={2} flat>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="agente-pais">País</Label>
              <Input
                id="agente-pais"
                value={form.pais ?? "CN"}
                onChange={(e) => setForm({ ...form, pais: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="agente-dias">Días de crédito</Label>
              <Input
                id="agente-dias"
                type="number"
                min={0}
                value={form.dias_credito}
                onChange={(e) => setForm({ ...form, dias_credito: Number(e.target.value) || 0 })}
              />
            </div>
          </div>
        </FormDialogSection>

        <FormDialogSection cols={1} flat>
          <div>
            <Label htmlFor="agente-contacto">Contacto</Label>
            <Input
              id="agente-contacto"
              value={form.contacto_tarifario ?? ""}
              onChange={(e) => setForm({ ...form, contacto_tarifario: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="agente-email">Email</Label>
            <Input
              id="agente-email"
              type="email"
              value={form.email ?? ""}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="agente-activo"
              checked={form.activo ?? true}
              onCheckedChange={(v) => setForm({ ...form, activo: v })}
            />
            <Label htmlFor="agente-activo">Activo</Label>
          </div>
        </FormDialogSection>
      </form>
    </FormDialogShell>
  );
}
