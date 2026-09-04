/**
 * Modal "Nuevo Cliente" — wizard de 2 pasos sobre `FormDialogShell`.
 * Paso 1: Datos fiscales + contacto (con opción de prellenar desde CSF).
 * Paso 2: Checklist documental.
 *
 * Mantiene el controller intacto y delega secciones a `NuevoClienteFormPieces`.
 */
import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { COPY_VALIDACION } from "@/lib/copy/publicoCopy";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import DocumentChecklist from "@/components/shared/DocumentChecklist";
import { useNuevoClienteController } from "@/features/cliente/hooks";
import {
  CsfDropZone,
  ModoAltaTabs,
  ClienteField,
  ClienteFiscalSelects,
} from "./NuevoClienteFormPieces";
import { rfcLooksValid, cpLooksValid, emailLooksValid } from "./nuevoClienteValidators";
import { ConfirmActionDialog } from "@/components/shared/dialogs/ConfirmActionDialog";


interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function NuevoClienteDialog({ open, onOpenChange }: Props) {
  const c = useNuevoClienteController(() => onOpenChange(false));
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [confirmarSalida, setConfirmarSalida] = useState(false);

  // R-15: no descartar la captura en silencio si el usuario ya escribió algo.
  const hayCambios =
    !!c.csfFile ||
    Object.values(c.form as Record<string, unknown>).some(
      (v) => v !== null && v !== undefined && v !== "" && v !== false,
    );

  const intentarCerrar = () => {
    if (hayCambios) setConfirmarSalida(true);
    else c.resetAndClose();
  };

  const triggerCsfUpload = (file: File | null) => {
    if (!file || !fileInputRef.current) return;
    const dt = new DataTransfer();
    dt.items.add(file);
    fileInputRef.current.files = dt.files;
    fileInputRef.current.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const prefilled = !!c.csfFile;

  const headerAside = prefilled ? (
    <div className="flex flex-col items-end gap-0.5">
      <span className="text-2xs font-semibold uppercase tracking-wide text-success">CSF detectada</span>
      <span className="text-xs text-muted-foreground truncate max-w-[180px]">{c.csfFile?.name}</span>
    </div>
  ) : undefined;

  return (
    <>
    <FormDialogShell
      open={open}
      onOpenChange={(abierto) => { if (!abierto) intentarCerrar(); else onOpenChange(abierto); }}
      icon={UserPlus}
      title="Nuevo cliente"
      description={
        c.step === 1
          ? "Captura los datos del cliente o sube su CSF para prellenar el formulario."
          : "Adjunta la Constancia de Situación Fiscal; el resto del expediente puede completarse después."
      }
      size="lg"
      stepper={{ step: c.step, totalSteps: 2, labels: ["Datos del cliente", "Documentación"] }}
      headerAside={headerAside}
      footer={c.step === 1 ? (
        <>
          <Button variant="outline" onClick={intentarCerrar}>Cancelar</Button>
          <Button onClick={c.handleNext} disabled={!c.isStep1Valid}>
            Siguiente <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </>
      ) : (
        <>
          <Button variant="outline" onClick={() => c.setStep(1)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Atrás
          </Button>
          <Button onClick={c.handleSave} disabled={!c.docsRequeridosCompletos} loading={c.isSaving}>
            {c.isSaving ? "Creando…" : "Crear cliente"}
          </Button>
        </>
      )}
    >
      {c.step === 1 && (
        <>
          {/* Input oculto que canaliza al handler original del controller. */}
          <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={c.handleCsfUpload} />

          <FormDialogSection flat title="Modo de captura">
            <ModoAltaTabs modo={c.modoAlta} onChange={c.setModoAlta} />
          </FormDialogSection>

          {c.modoAlta === "csf" && (
            <FormDialogSection flat>
              <CsfDropZone
                parsingCsf={c.parsingCsf}
                fileName={c.csfFile?.name ?? null}
                onFile={triggerCsfUpload}
              />
            </FormDialogSection>
          )}

          <FormDialogSection title="Datos fiscales" description="Información requerida para facturación SAT.">
            <ClienteField label="RFC" field="rfc" form={c.form} onChange={c.handleChange} required
              prefilledFromCsf={prefilled} validate={(v) => (!rfcLooksValid(v) ? "Formato de RFC inválido" : null)} />
            <ClienteField label="Código Postal" field="cp" form={c.form} onChange={c.handleChange} required
              prefilledFromCsf={prefilled} validate={(v) => (!cpLooksValid(v) ? "Deben ser 5 dígitos" : null)} />
            <ClienteFiscalSelects form={c.form} onChange={c.handleChange} prefilledRegimen={prefilled} />
          </FormDialogSection>

          <FormDialogSection title="Datos generales y contacto">
            <ClienteField className="md:col-span-2" label="Nombre / Razón Social" field="nombre"
              form={c.form} onChange={c.handleChange} required prefilledFromCsf={prefilled} />
            <ClienteField className="md:col-span-2" label="Dirección" field="direccion"
              form={c.form} onChange={c.handleChange} prefilledFromCsf={prefilled} />
            <ClienteField label="Ciudad" field="ciudad" form={c.form} onChange={c.handleChange} prefilledFromCsf={prefilled} />
            <ClienteField label="Estado" field="estado" form={c.form} onChange={c.handleChange} prefilledFromCsf={prefilled} />
            <ClienteField label="Contacto" field="contacto" form={c.form} onChange={c.handleChange} required />
            <ClienteField label="Email" field="email" form={c.form} onChange={c.handleChange} required
              validate={(v) => (v && !emailLooksValid(v) ? COPY_VALIDACION.correoInvalido : null)} />
            <ClienteField label="Teléfono" field="telefono" form={c.form} onChange={c.handleChange} required />

          </FormDialogSection>
        </>
      )}

      {c.step === 2 && (
        <DocumentChecklist
          documentos={c.documentos}
          onFileChange={c.handleFileChange}
          descripcion="Sólo la Constancia de Situación Fiscal (CSF) es obligatoria. Los demás documentos son opcionales y puedes subirlos más adelante desde el detalle del cliente."
        />
      )}
    </FormDialogShell>
      <ConfirmActionDialog
        open={confirmarSalida}
        onOpenChange={setConfirmarSalida}
        title="¿Descartar el alta del cliente?"
        description="Perderás los datos capturados y los documentos adjuntos de este formulario."
        confirmLabel="Descartar"
        cancelLabel="Seguir editando"
        variant="destructive"
        onConfirm={() => { setConfirmarSalida(false); c.resetAndClose(); }}
      />
    </>
  );
}
