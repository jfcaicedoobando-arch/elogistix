/**
 * v13.624.0 — "Cliente de casa": define si el cliente debe autorizar
 * cotizaciones y proformas antes de operar.
 *
 * Al apagar un switch, el equipo interno puede aceptar el documento sin
 * esperar la respuesta del cliente (queda registrado en la bitácora).
 */
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { FormDialogSection } from "@/components/shared/FormDialogSection";

interface Value {
  requiere_autorizacion_cotizacion: boolean;
  requiere_autorizacion_proforma: boolean;
}

interface Props<T extends Value> {
  form: T;
  setForm: (fn: (prev: T) => T) => void;
  /** Sólo administradores y gerencia comercial pueden cambiar la política. */
  disabled?: boolean;
}

interface FilaProps {
  id: string;
  titulo: string;
  ayuda: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}

function FilaSwitch({ id, titulo, ayuda, checked, disabled, onChange }: FilaProps) {
  return (
    <div className="md:col-span-2 flex items-start justify-between gap-4 rounded-md border border-border p-3">
      <div className="space-y-1">
        <Label htmlFor={id}>{titulo}</Label>
        <p className="text-xs text-muted-foreground">{ayuda}</p>
      </div>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  );
}

export function AutorizacionClienteSection<T extends Value>({ form, setForm, disabled }: Props<T>) {
  const sinAutorizaciones =
    !form.requiere_autorizacion_cotizacion && !form.requiere_autorizacion_proforma;

  return (
    <FormDialogSection
      title="Autorización del cliente"
      description="Para clientes de casa puedes omitir la autorización y agilizar la operación."
    >
      <FilaSwitch
        id="cliente-req-aut-cotizacion"
        titulo="Requiere autorizar cotizaciones"
        ayuda="Activado: la cotización debe estar enviada y aceptada por el cliente. Apagado: el equipo puede aceptarla internamente."
        checked={form.requiere_autorizacion_cotizacion}
        disabled={disabled}
        onChange={(v) => setForm((p) => ({ ...p, requiere_autorizacion_cotizacion: v }))}
      />
      <FilaSwitch
        id="cliente-req-aut-proforma"
        titulo="Requiere autorizar proformas"
        ayuda="Activado: se espera la respuesta del cliente antes de facturar. Apagado: el equipo puede aprobarla internamente."
        checked={form.requiere_autorizacion_proforma}
        disabled={disabled}
        onChange={(v) => setForm((p) => ({ ...p, requiere_autorizacion_proforma: v }))}
      />
      {sinAutorizaciones && (
        <div className="md:col-span-2">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Este cliente quedará marcado como <strong>cliente de casa</strong>: sus cotizaciones y
              proformas podrán aceptarse internamente. Cada aprobación se registra en la bitácora.
            </AlertDescription>
          </Alert>
        </div>
      )}
      {disabled && (
        <p className="md:col-span-2 text-xs text-muted-foreground">
          Sólo administración o gerencia comercial puede cambiar esta política.
        </p>
      )}
    </FormDialogSection>
  );
}
