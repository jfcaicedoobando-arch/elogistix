/**
 * Diálogo para crear un nuevo Lead (CRM Fase 2).
 * Formulario simple — los campos avanzados se editan en LeadDetalle.
 * Migrado a `FormDialogShell` (v13.121.0).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Target } from "lucide-react";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogFooter } from "@/components/shared/FormDialogFooter";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useNuevoLeadSubmit } from "@/features/crm/hooks";
import { NuevoLeadForm, type LeadFormState } from "./nuevoLead/NuevoLeadForm";
import { AvisoLeadDuplicado } from "./AvisoLeadDuplicado";
import { esCorreoCapturado } from "@/features/crm/domain/leads/quickCreateInput";


interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Borrador del alta express ("Más campos →"): empresa y contacto capturados. */
  draftInicial?: { empresa: string; contacto: string } | null;
  onCreated?: (id: string) => void;
}

const EMPTY: LeadFormState = {
  empresa: "",
  contacto: "",
  email: "",
  telefono: "",
  ciudad: "",
  pais: "México",
  fuente: "Otro",
  estado: "Nuevo",
  interes_modo: "",
  notas: "",
  vendedor_id: null,
  vendedor_email: "",
};

export default function NuevoLeadDialog({ open, onOpenChange, draftInicial, onCreated }: Props) {
  const { user } = useAuth();
  // v13.823.50 — al limpiar el formulario se volvía a `EMPTY` (sin vendedor),
  // así que sólo el primer lead de la sesión quedaba asignado al usuario.
  const formVacio = useCallback(
    (): LeadFormState => ({ ...EMPTY, vendedor_id: user?.id ?? null, vendedor_email: user?.email ?? "" }),
    [user?.id, user?.email],
  );
  // El contacto express se clasifica con el mapeo canónico compartido: no se
  // inventan datos, sólo se coloca en `email` o `telefono` según su forma.
  const empresaDraft = draftInicial?.empresa ?? "";
  const contactoDraft = draftInicial?.contacto ?? "";
  const formConDraft = useCallback((): LeadFormState => {
    const base = formVacio();
    const dato = contactoDraft.trim();
    if (!empresaDraft.trim() && !dato) return base;
    const esCorreo = esCorreoCapturado(dato);
    return {
      ...base,
      empresa: empresaDraft.trim(),
      email: dato && esCorreo ? dato.toLowerCase() : "",
      telefono: dato && !esCorreo ? dato : "",
    };
  }, [formVacio, empresaDraft, contactoDraft]);
  const [form, setForm] = useState<LeadFormState>(formConDraft);

  // Al abrirse (cerrado -> abierto) se siembra el borrador express; el reset al
  // cerrar se conserva intacto.
  const abiertoAntes = useRef(open);
  useEffect(() => {
    if (open && !abiertoAntes.current) setForm(formConDraft());
    abiertoAntes.current = open;
  }, [open, formConDraft]);
  const [autoActividad, setAutoActividad] = useState(true);

  const resetForm = useCallback(() => setForm(formVacio()), [formVacio]);
  const { handleSubmit, pendingTotal, emailInvalido } = useNuevoLeadSubmit({
    form,
    autoActividad,
    onSaved: (id) => {
      onOpenChange(false);
      onCreated?.(id);
    },
    resetForm,
  });

  const defaults = useMemo(() => formConDraft(), [formConDraft]);
  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(defaults) || autoActividad !== true,
    [form, defaults, autoActividad],
  );

  const handleOpenChange = (o: boolean) => {
    if (!o) {
      setForm(formVacio());
      setAutoActividad(true);
    }
    onOpenChange(o);
  };

  const footer = (
    <FormDialogFooter
      onCancel={() => handleOpenChange(false)}
      onConfirm={handleSubmit}
      confirmLabel="Crear lead"
      loading={pendingTotal}
      disabled={emailInvalido}
    />
  );

  return (
    <FormDialogShell
      open={open}
      onOpenChange={handleOpenChange}
      icon={Target}
      title="Nuevo lead"
      description="Captura los datos básicos del prospecto. Podrás convertirlo a cliente y oportunidad desde su ficha."
      size="2xl"
      busy={pendingTotal}
      isDirty={isDirty}
      footer={footer}
    >


      <AvisoLeadDuplicado
        empresa={form.empresa}
        email={form.email}
        telefono={form.telefono}
      />
      <NuevoLeadForm
        form={form}
        setForm={setForm}
        autoActividad={autoActividad}
        setAutoActividad={setAutoActividad}
        emailError={emailInvalido ? "Correo inválido: usa la forma usuario@dominio.com o deja el campo vacío." : undefined}
      />
    </FormDialogShell>
  );
}
