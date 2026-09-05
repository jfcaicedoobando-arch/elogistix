/**
 * Formularios completos ("Más campos →") del alta express del CRM.
 * Extraído de `QuickAddMenu` para mantenerlo compacto.
 */
import { useNavigate } from "react-router-dom";
import NuevoLeadDialog from "@/features/crm/components/NuevoLeadDialog";
import NuevaOportunidadDialog from "@/features/crm/components/NuevaOportunidadDialog";
import NuevaActividadDialog from "@/features/crm/components/NuevaActividadDialog";
import ImportarLeadsCsvDialog from "@/features/crm/components/ImportarLeadsCsvDialog";
import type { LeadQuickDraft } from "@/features/crm/components/quickCreate/QuickCreateLeadDialog";
import type { OportunidadQuickDraft } from "@/features/crm/components/quickCreate/QuickCreateOportunidadDialog";
import type { ActividadQuickDraft } from "@/features/crm/components/quickCreate/QuickCreateActividadDialog";

/** Props del borrador express hacia el formulario completo de actividad. */
function propsActividad(draft: ActividadQuickDraft | null) {
  return {
    asuntoInicial: draft?.asunto ?? null,
    fechaInicial: draft?.fecha ?? null,
    entidadIdInicial: draft?.entidadId ?? null,
  };
}

interface Props {
  leadOpen: boolean;
  onLeadOpenChange: (open: boolean) => void;
  leadDraft: LeadQuickDraft | null;
  opOpen: boolean;
  onOpOpenChange: (open: boolean) => void;
  opDraft: OportunidadQuickDraft | null;
  actOpen: boolean;
  onActOpenChange: (open: boolean) => void;
  actDraft: ActividadQuickDraft | null;
  importOpen: boolean;
  onImportOpenChange: (open: boolean) => void;
}

export default function QuickAddFullDialogs({
  leadOpen, onLeadOpenChange, leadDraft,
  opOpen, onOpOpenChange, opDraft,
  actOpen, onActOpenChange, actDraft,
  importOpen, onImportOpenChange,
}: Props) {
  const navigate = useNavigate();
  return (
    <>
      <NuevoLeadDialog
        open={leadOpen}
        onOpenChange={onLeadOpenChange}
        draftInicial={leadDraft}
        onCreated={(id) => navigate(`/crm/leads/${id}`)}
      />
      <NuevaOportunidadDialog
        open={opOpen}
        onOpenChange={onOpOpenChange}
        origenInicial={opDraft?.origen ?? null}
        nombreInicial={opDraft?.nombre ?? null}
        onSaved={(id) => navigate(`/crm/oportunidades/${id}`)}
      />
      <NuevaActividadDialog
        open={actOpen}
        onOpenChange={onActOpenChange}
        {...propsActividad(actDraft)}
        onCreated={() => navigate("/crm/actividades")}
      />
      <ImportarLeadsCsvDialog open={importOpen} onOpenChange={onImportOpenChange} />
    </>
  );
}
