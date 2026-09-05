/**
 * Diálogo para crear / editar una Oportunidad CRM.
 * Form fields en `nuevaOportunidad/OportunidadFormFields`; estado en `useOportunidadForm`.
 * Migrado a `FormDialogShell` (v13.121.0).
 */
import { useEffect, useRef, useState } from "react";
import { Briefcase } from "lucide-react";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogFooter } from "@/components/shared/FormDialogFooter";
import { useAuth } from "@/lib/contexts/AuthContext";
import {
  type CrmOportunidadRow,
  useEtapasPipeline,
  useOportunidadForm,
  type OrigenInicial,
} from "@/features/crm/hooks";
import { useClientesForSelect } from "@/features/cliente/hooks";
import OportunidadFormFields from "@/features/crm/components/nuevaOportunidad/OportunidadFormFields";
import { useNuevaOportunidadSubmit } from "@/features/crm/hooks/useNuevaOportunidadSubmit";
import { faltantesOportunidadForm } from "@/features/crm/domain/oportunidadFormPayload";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  oportunidad?: CrmOportunidadRow | null;
  onSaved?: (id: string) => void;
  /** Fase 2 rediseño CRM: prefija el origen (prospecto o cliente). */
  origenInicial?: OrigenInicial | null;
  /** Nombre precapturado en el alta express al pulsar "Más campos". */
  nombreInicial?: string | null;
  /** Etapa prefijada por el CTA de una columna del Kanban (sólo si abierta). */
  etapaInicialId?: string | null;
}

export default function NuevaOportunidadDialog({
  open,
  onOpenChange,
  oportunidad,
  onSaved,
  origenInicial,
  nombreInicial,
  etapaInicialId,
}: Props) {
  const isEdit = !!oportunidad;
  const { user } = useAuth();
  const { data: etapas = [] } = useEtapasPipeline();
  const { data: clientes = [] } = useClientesForSelect() as { data: { id: string; nombre: string }[] | undefined };

  const { form, setForm, set, isDirty, markClean } = useOportunidadForm(
    open,
    oportunidad,
    etapas,
    user,
    { origen: origenInicial, nombre: nombreInicial, etapaId: etapaInicialId },
  );
  const [autoActividad, setAutoActividad] = useState(true);

  // Al cerrar de verdad una creación, la casilla de actividad automática
  // vuelve a su valor por omisión para la siguiente apertura. En edición no
  // aplica (la casilla no se muestra).
  const abiertoAntes = useRef(open);
  useEffect(() => {
    if (abiertoAntes.current && !open && !isEdit) setAutoActividad(true);
    abiertoAntes.current = open;
  }, [open, isEdit]);

  const etapaSel = etapas.find((e) => e.id === form.etapa_id);
  const esGanada = (etapaSel as { tipo?: string } | undefined)?.tipo === "ganada";

  const { handleSubmit, pendingTotal } = useNuevaOportunidadSubmit({
    form, esGanada, isEdit, oportunidad, autoActividad, markClean, onOpenChange, onSaved,
  });
  // Sucio total: el formulario más la casilla de actividad automática (sólo
  // relevante al crear). Habilita la confirmación de descarte del shell.
  const dirtyTotal = isDirty || (!isEdit && autoActividad !== true);

  // Candado explícito al crear: sin origen, nombre o etapa el botón no debe
  // parecer accionable (antes el clic era un no-op silencioso).
  const faltantes = isEdit ? [] : faltantesOportunidadForm(form);

  const footer = (
    <FormDialogFooter
      onCancel={() => onOpenChange(false)}
      onConfirm={handleSubmit}
      confirmLabel={isEdit ? "Guardar cambios" : "Crear oportunidad"}
      loading={pendingTotal}
      disabled={faltantes.length > 0}
    />
  );

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Briefcase}
      title={isEdit ? "Editar oportunidad" : "Nueva oportunidad"}
      description="Captura los datos comerciales y la etapa del pipeline."
      size="2xl"
      isDirty={dirtyTotal}
      busy={pendingTotal}
      footer={footer}
    >
      {faltantes.length > 0 && (
        <p
          role="status"
          aria-live="polite"
          className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-body-sm text-destructive"
        >
          Para crear la oportunidad falta: {faltantes.join(", ")}.
        </p>
      )}
      <OportunidadFormFields
        form={form}
        setForm={setForm}
        set={set}
        etapas={etapas}
        clientes={clientes}
        isEdit={isEdit}
        autoActividad={autoActividad}
        setAutoActividad={setAutoActividad}
      />
    </FormDialogShell>
  );
}
