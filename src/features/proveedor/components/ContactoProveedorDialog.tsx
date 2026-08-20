/**
 * Ola 4 — Alta/edición de un contacto del proveedor.
 * Mismo shell de formulario que el resto del ERP.
 */
import { useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  CONTACTO_PROVEEDOR_VACIO,
  contactoAForm,
  validarContactoProveedor,
  type ContactoProveedor,
  type ContactoProveedorForm,
} from "@/features/proveedor/domain/contactosProveedor";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacto: ContactoProveedor | null;
  isPending: boolean;
  onGuardar: (form: ContactoProveedorForm) => void;
}

const FORM_ID = "form-contacto-proveedor";

export function ContactoProveedorDialog({
  open, onOpenChange, contacto, isPending, onGuardar,
}: Props) {
  const [form, setForm] = useState<ContactoProveedorForm>(CONTACTO_PROVEEDOR_VACIO);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(contacto ? contactoAForm(contacto) : CONTACTO_PROVEEDOR_VACIO);
    setError(null);
  }, [open, contacto]);

  const set = <K extends keyof ContactoProveedorForm>(
    campo: K,
    valor: ContactoProveedorForm[K],
  ) => setForm((prev) => ({ ...prev, [campo]: valor }));

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const problema = validarContactoProveedor(form);
    if (problema) { setError(problema); return; }
    setError(null);
    onGuardar(form);
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={UserPlus}
      title={contacto ? "Editar contacto" : "Nuevo contacto del proveedor"}
      description="Registra a las personas con quienes operas: pagos, tráfico, facturación."
      size="md"
      formId={FORM_ID}
      onSubmit={onSubmit}
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form={FORM_ID} loading={isPending}>
            Guardar contacto
          </Button>
        </>
      }
    >
      <FormDialogSection title="Persona">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="cp-nombre">Nombre</Label>
            <Input id="cp-nombre" value={form.nombre}
              onChange={(e) => set("nombre", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cp-puesto">Puesto</Label>
            <Input id="cp-puesto" value={form.puesto}
              onChange={(e) => set("puesto", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cp-area">Área</Label>
            <Input id="cp-area" value={form.area} placeholder="Tráfico, Cobranza, Ventas…"
              onChange={(e) => set("area", e.target.value)} />
          </div>
        </div>
      </FormDialogSection>

      <FormDialogSection title="Medios de contacto">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="cp-email">Correo</Label>
            <Input id="cp-email" type="email" value={form.email}
              onChange={(e) => set("email", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cp-tel">Teléfono</Label>
            <Input id="cp-tel" value={form.telefono}
              onChange={(e) => set("telefono", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cp-ext">Extensión</Label>
            <Input id="cp-ext" value={form.extension}
              onChange={(e) => set("extension", e.target.value)} />
          </div>
        </div>
      </FormDialogSection>

      <FormDialogSection
        title="Preferencias"
        description="El contacto principal es el que usamos por defecto para avisos y envíos."
      >
        <div className="flex items-center justify-between rounded-md border p-3">
          <Label htmlFor="cp-principal">Contacto principal</Label>
          <Switch id="cp-principal" checked={form.es_principal}
            onCheckedChange={(v) => set("es_principal", v)} />
        </div>
        <div className="mt-4 space-y-2">
          <Label htmlFor="cp-notas">Notas (opcional)</Label>
          <Textarea id="cp-notas" rows={3} value={form.notas}
            onChange={(e) => set("notas", e.target.value)} />
        </div>
        {error && <p role="alert" className="mt-2 text-body text-destructive">{error}</p>}
      </FormDialogSection>
    </FormDialogShell>
  );
}
