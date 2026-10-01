/**
 * Alta rápida de Empresa o Contacto del CRM.
 */
import { useState, type FormEvent } from "react";
import { Building2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { useCrearContactoCrm, useCrearEmpresaCrm } from "@/features/crm/hooks/useObjetosCrm";

interface Props {
  objeto: "empresa" | "contacto";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FORM_ID = "nuevo-objeto-crm";

export function NuevoObjetoCrmDialog({ objeto, open, onOpenChange }: Props) {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const crearEmpresa = useCrearEmpresaCrm();
  const crearContacto = useCrearContactoCrm();
  const pendiente = crearEmpresa.isPending || crearContacto.isPending;
  const esEmpresa = objeto === "empresa";

  const cerrar = () => { setNombre(""); setEmail(""); setTelefono(""); onOpenChange(false); };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!nombre.trim() || pendiente) return;
    const opts = { onSuccess: cerrar };
    if (esEmpresa) crearEmpresa.mutate(nombre, opts);
    else crearContacto.mutate({ nombre, email, telefono }, opts);
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={(o) => (o ? onOpenChange(true) : cerrar())}
      icon={esEmpresa ? Building2 : UserRound}
      title={esEmpresa ? "Nueva empresa" : "Nuevo contacto"}
      size="md"
      formId={FORM_ID}
      onSubmit={onSubmit}
      isDirty={!!(nombre || email || telefono) && !pendiente}
      busy={pendiente}
      footer={
        <>
          <Button type="button" variant="outline" onClick={cerrar} disabled={pendiente}>Cancelar</Button>
          <Button type="submit" form={FORM_ID} disabled={!nombre.trim() || pendiente}>
            {pendiente ? "Guardando…" : "Guardar"}
          </Button>
        </>
      }
    >
      <FormDialogSection cols={esEmpresa ? 1 : 2}>
        <div className="space-y-1.5">
          <Label htmlFor="obj-nombre">Nombre *</Label>
          <Input id="obj-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={200} />
        </div>
        {!esEmpresa && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="obj-email">Correo</Label>
              <Input id="obj-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="obj-tel">Teléfono</Label>
              <Input id="obj-tel" type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} maxLength={30} />
            </div>
          </>
        )}
      </FormDialogSection>
    </FormDialogShell>
  );
}
