import { useState } from "react";
import { UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { ClienteFiscalSelects } from "@/features/cliente/components/ClienteFiscalSelects";
import {
  validarClienteConversion,
  type ErroresClienteConversion,
} from "@/features/cliente/domain/validarClienteConversion";

import type { ClienteFormData } from "@/features/cliente/types/clienteForm";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteForm: ClienteFormData;
  setClienteForm: React.Dispatch<React.SetStateAction<ClienteFormData>>;
  onConvertir: () => void;
  isPending: boolean;
}

/** Campo de texto con mensaje de error inline (se muestra tras el primer intento). */
function Campo({
  id, label, value, onChange, error, required = true, className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={id} size="sm" className="flex items-center">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <Input
        id={id}
        className="mt-1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
      />
      {error && <p className="mt-1 text-body-sm text-destructive">{error}</p>}
    </div>
  );
}

export default function DialogConvertirProspecto({
  open, onOpenChange, clienteForm, setClienteForm, onConvertir, isPending,
}: Props) {
  const [intentado, setIntentado] = useState(false);
  const errores: ErroresClienteConversion = validarClienteConversion(clienteForm);
  const err = (campo: keyof ClienteFormData) => (intentado ? errores[campo] : undefined);
  const set = (campo: keyof ClienteFormData) => (v: string) =>
    setClienteForm((p) => ({ ...p, [campo]: v }));

  const intentarConvertir = () => {
    setIntentado(true);
    // El error NO cierra el modal ni pierde lo capturado.
    if (Object.keys(errores).length > 0) return;
    onConvertir();
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={UserCheck}
      title="Convertir prospecto a cliente"
      description="Da de alta al cliente con sus datos fiscales completos para poder facturar y crear el embarque."
      size="lg"
      busy={isPending}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={intentarConvertir} disabled={isPending}>
            {isPending ? "Convirtiendo…" : "Convertir a cliente"}
          </Button>
        </>
      }
    >
      <FormDialogSection title="Datos de contacto">
        <Campo
          id="conv-nombre" label="Nombre / Razón social" className="md:col-span-2"
          value={clienteForm.nombre} onChange={set("nombre")} error={err("nombre")}
        />
        <Campo id="conv-contacto" label="Contacto" value={clienteForm.contacto} onChange={set("contacto")} error={err("contacto")} />
        <Campo id="conv-email" label="Correo" value={clienteForm.email} onChange={set("email")} error={err("email")} />
        <Campo id="conv-telefono" label="Teléfono" value={clienteForm.telefono} onChange={set("telefono")} error={err("telefono")} />
      </FormDialogSection>

      <FormDialogSection title="Datos fiscales">
        <Campo id="conv-rfc" label="RFC" value={clienteForm.rfc} onChange={set("rfc")} error={err("rfc")} />
        <Campo id="conv-cp" label="C.P. fiscal" value={clienteForm.cp} onChange={set("cp")} error={err("cp")} />
        <Campo
          id="conv-direccion" label="Dirección fiscal" className="md:col-span-2"
          value={clienteForm.direccion} onChange={set("direccion")} error={err("direccion")}
        />
        <Campo id="conv-ciudad" label="Ciudad" required={false} value={clienteForm.ciudad} onChange={set("ciudad")} />
        <Campo id="conv-estado" label="Estado" required={false} value={clienteForm.estado} onChange={set("estado")} />
        <ClienteFiscalSelects
          form={clienteForm}
          onChange={(campo, valor) => setClienteForm((p) => ({ ...p, [campo]: valor }))}
        />
        {intentado && (
          <div className="md:col-span-2 space-y-1">
            {(["regimen_fiscal", "uso_cfdi_default", "forma_pago_default", "metodo_pago_default"] as const)
              .filter((c) => errores[c])
              .map((c) => (
                <p key={c} className="text-body-sm text-destructive">{errores[c]}</p>
              ))}
          </div>
        )}
      </FormDialogSection>
    </FormDialogShell>
  );
}
