/**
 * Diálogo para crear un nuevo Lead (CRM Fase 2).
 * Formulario simple — los campos avanzados se editan en LeadDetalle.
 * Migrado a `FormDialogShell` (v13.121.0).
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { Target } from "lucide-react";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogFooter } from "@/components/shared/FormDialogFooter";
import { notifyError } from "@/lib/ui/appFeedback";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useCrearLead } from "@/features/crm/hooks";
import { useCrearActividad } from "@/features/crm/hooks";
import { NuevoLeadForm, type LeadFormState } from "./nuevoLead/NuevoLeadForm";
import { AvisoLeadDuplicado } from "./AvisoLeadDuplicado";
import { ERROR_CODES } from "@/lib/domain/errorCatalog";
import { actividadDefaultFechaMx } from "@/features/crm/domain/actividadDefaultFecha";
import { mxLocalToUtcIso } from "@/lib/date/mx";
import { emailLooksValid } from "@/features/cliente/components/nuevoClienteValidators";


interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export default function NuevoLeadDialog({ open, onOpenChange, onCreated }: Props) {
  const { user } = useAuth();
  // v13.823.50 — al limpiar el formulario se volvía a `EMPTY` (sin vendedor),
  // así que sólo el primer lead de la sesión quedaba asignado al usuario.
  const formVacio = useCallback(
    (): LeadFormState => ({ ...EMPTY, vendedor_id: user?.id ?? null, vendedor_email: user?.email ?? "" }),
    [user?.id, user?.email],
  );
  const [form, setForm] = useState<LeadFormState>(formVacio);
  const [autoActividad, setAutoActividad] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const crear = useCrearLead();
  const crearActividad = useCrearActividad();
  const enviandoRef = useRef(false);

  const pendingTotal = guardando || crear.isPending || crearActividad.isPending;
  const defaults = useMemo(() => formVacio(), [formVacio]);
  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(defaults) || autoActividad !== true,
    [form, defaults, autoActividad],
  );

  // Correo opcional: si viene capturado debe tener forma válida (regla central
  // `emailLooksValid`). El flujo mínimo "correo o teléfono" se conserva: vacío es válido.
  const emailInvalido = form.email.trim() !== "" && !emailLooksValid(form.email);

  const handleSubmit = async () => {

    if (crear.isPending || crearActividad.isPending || enviandoRef.current || guardando) return;
    if (!form.empresa.trim()) {
      notifyError(undefined, { title: "Empresa es obligatoria", method: "HANDLE_SUBMIT", errorCode: ERROR_CODES.VALIDATION_FAILED });
      return;
    }
    if (emailInvalido) {
      notifyError(undefined, {
        title: "Correo inválido",
        description: "Escribe un correo con la forma usuario@dominio.com o déjalo vacío.",
        method: "HANDLE_SUBMIT",
        errorCode: ERROR_CODES.VALIDATION_FAILED,
      });
      return;
    }
    enviandoRef.current = true;
    setGuardando(true);
    try {
      const r = await crear.mutateAsync(form);
      if (autoActividad) {
        // Hallazgo #13.3: el lead ya se creó; si falla la tarea automática el
        // aviso debe decirlo explícitamente. `silencioso` evita el toast doble.
        try {
          await crearActividad.mutateAsync({
            tipo: "llamada",
            asunto: `Primer contacto: ${form.empresa}`,
            descripcion: "Actividad creada automáticamente al alta del lead.",
            entidad_tipo: "lead",
            entidad_id: r.id,
            fecha_programada: mxLocalToUtcIso(actividadDefaultFechaMx()),
            responsable_id: form.vendedor_id ?? null,
            responsable_email: form.vendedor_email ?? "",
            silencioso: true,
          });
        } catch (e) {
          notifyError(undefined, {
            title: "Registro creado, pero no se pudo crear la tarea automática de seguimiento",
            description: e instanceof Error ? e.message : undefined,
            error: e,
            method: "CREAR_ACTIVIDAD_SEGUIMIENTO_LEAD",
          });
        }
      }

      setForm(formVacio());
      onOpenChange(false);
      onCreated?.(r.id);
    } catch {
      // El feedback de error ya lo muestra `useCrearLead` (onError): notificar
      // aquí también duplicaba el toast para una sola acción. El aviso
      // específico de la actividad automática (arriba) se conserva porque esa
      // mutación va con `silencioso`.
    } finally {
      enviandoRef.current = false;
      setGuardando(false);
    }
  };


  const handleOpenChange = (o: boolean) => {
    if (!o) {
      setForm(formVacio());
      setAutoActividad(true);
    }
    onOpenChange(o);
  };

  const footer = (
    <FormDialogFooter
      onCancel={() => onOpenChange(false)}
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
