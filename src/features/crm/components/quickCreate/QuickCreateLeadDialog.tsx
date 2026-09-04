/**
 * QuickCreateLeadDialog — alta express de lead (empresa + correo/teléfono).
 *
 * v13.746.0: antes era un Popover anclado al menú "Nuevo" (`QuickCreateLeadPopover`).
 * Abrirlo desde un item del DropdownMenu perdía la carrera contra el cierre del
 * menú (clic fuera + devolución de foco en el mismo gesto), así que al usuario
 * "no le pasaba nada" al dar clic. Ahora es un modal estándar (FormDialogShell),
 * que sí se puede abrir desde un item de menú sin condiciones de carrera.
 *
 * Corrección de estado: guard anti doble submit, `busy` mientras guarda y
 * limpieza del formulario sólo al cerrarse de verdad (open true -> false), para
 * que al reabrir no reaparezcan datos descartados.
 */
import { useEffect, useRef, useState } from "react";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { FormDialogFooter } from "@/components/shared/FormDialogFooter";
import { notifySuccess, notifyError } from "@/lib/ui/appFeedback";
import { getErrorMessage } from "@/lib/errors";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useCrearLead } from "@/features/crm/hooks";
import { leadQuickCreateInput } from "@/features/crm/domain/leads/quickCreateInput";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
  /** Abre el diálogo completo con todos los campos. */
  onMore: () => void;
}

export default function QuickCreateLeadDialog({ open, onOpenChange, onCreated, onMore }: Props) {
  const { user } = useAuth();
  const crear = useCrearLead();
  const enviandoRef = useRef(false);
  const [empresa, setEmpresa] = useState("");
  const [contacto, setContacto] = useState("");

  // Reset sólo en la transición real abierto -> cerrado: mientras el modal
  // sigue abierto (o mientras se muestra la confirmación de descarte, que vive
  // dentro del shell con `open` en true) el formulario queda intacto.
  const abiertoAntes = useRef(open);
  useEffect(() => {
    if (abiertoAntes.current && !open) {
      setEmpresa("");
      setContacto("");
    }
    abiertoAntes.current = open;
  }, [open]);

  const submit = async () => {
    if (crear.isPending || enviandoRef.current) return;
    const emp = empresa.trim();
    if (!emp) {
      notifyError(undefined, { title: "Empresa requerida", method: "FEATURES_CRM_COMPONENTS_QUICKCREATE_QUICKCREATELEADDIALOG_1" });
      return;
    }
    enviandoRef.current = true;
    try {
      // Mapeo canónico compartido: "Correo o teléfono" → `email` / `telefono`.
      const r = await crear.mutateAsync(leadQuickCreateInput(emp, contacto, user));
      notifySuccess(undefined, { title: "Lead creado", duration: 2000 });
      // El cierre limpia el estado (efecto de transición): no hace falta resetear aquí.
      onOpenChange(false);
      onCreated(r.id);
    } catch (e) {
      notifyError(undefined, {
        title: "No se pudo crear el lead", description: getErrorMessage(e),
        error: e,
        method: "FEATURES_CRM_COMPONENTS_QUICKCREATE_QUICKCREATELEADDIALOG_2",
      });
    } finally {
      enviandoRef.current = false;
    }
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Users}
      title="Nuevo lead"
      description="Captura lo mínimo para no perder el prospecto; el resto se completa después."
      size="md"
      formId="qc-lead-form"
      onSubmit={(e) => { e.preventDefault(); void submit(); }}
      isDirty={empresa.trim().length > 0 || contacto.trim().length > 0}
      busy={crear.isPending}
      footer={
        <FormDialogFooter
          formId="qc-lead-form"
          onCancel={() => onOpenChange(false)}
          confirmLabel="Crear"
          loading={crear.isPending}
          extra={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onMore}
              disabled={crear.isPending}
              className="text-body-sm"
            >
              Más campos →
            </Button>
          }
        />
      }
    >
      <FormDialogSection flat>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="qc-lead-empresa">Empresa *</Label>
            <Input
              id="qc-lead-empresa"
              value={empresa}
              onChange={(e) => setEmpresa(e.target.value)}
              placeholder="Acme Logistics"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="qc-lead-contacto">Correo o teléfono</Label>
            <Input
              id="qc-lead-contacto"
              value={contacto}
              onChange={(e) => setContacto(e.target.value)}
              placeholder="ana@acme.com o 555…"
            />
          </div>
        </div>
      </FormDialogSection>
    </FormDialogShell>
  );
}
