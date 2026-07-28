/**
 * /crm/leads/:id — Ficha de lead con edición en línea, eliminación y conversión.
 * Lógica de formulario en `useLeadEditForm`; subcomponentes en `components/crm/leadDetalle/`.
 */
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DetailHeader } from "@/components/shared/DetailHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { LoadingState } from "@/components/shared/states/LoadingState";
import { ErrorState } from "@/components/shared/states/ErrorState";
import DoubleConfirmDeleteDialog from "@/components/shared/DoubleConfirmDeleteDialog";
import { notifyError } from "@/lib/ui/appFeedback";
import { crmToast } from "@/features/crm/lib/crmToast";
import { usePermissions } from "@/hooks/shared";
import ConvertirLeadDialog from "@/features/crm/components/ConvertirLeadDialog";
import ConvertirLeadSheet from "@/features/crm/components/ConvertirLeadSheet";
import { LeadLineageCard } from "@/features/crm/components/LineageCard";
import ContactActions from "@/features/crm/components/ContactActions";
import ActividadTimeline from "@/features/crm/components/ActividadTimeline";
import LeadDatosCard from "@/features/crm/components/leadDetalle/LeadDatosCard";
import LeadHeaderActions from "@/features/crm/components/leadDetalle/LeadHeaderActions";
import { useActualizarLead, useEliminarLead, useLead } from "@/features/crm/hooks";
import { useLeadEditForm } from "@/features/crm/hooks";
import { ROUTES } from "@/constants/routes";
import { formatFechaEs } from "@/lib/formatters/dates";

export default function LeadDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canEdit } = usePermissions();
  const { data: lead, isLoading } = useLead(id);
  const actualizar = useActualizarLead();
  const eliminar = useEliminarLead();

  const { form, set, dirty } = useLeadEditForm(lead);
  const [convertirSheetOpen, setConvertirSheetOpen] = useState(false);
  const [convertirAvanzadoOpen, setConvertirAvanzadoOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleSave = async () => {
    if (!id) return;
    try {
      await actualizar.mutateAsync({ id, patch: form });
      crmToast.success("Cambios guardados");
    } catch (e) {
      notifyError(undefined, {
        title: "No se pudo guardar",
        description: e instanceof Error ? e.message : undefined,
        error: e,
        method: "HANDLE_SAVE",
      });
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await eliminar.mutateAsync(id);
      crmToast.success("Lead eliminado");
      navigate(ROUTES.CRM_LEADS);
    } catch (e) {
      notifyError(undefined, {
        title: "No se pudo eliminar",
        description: e instanceof Error ? e.message : undefined,
        error: e,
        method: "HANDLE_DELETE",
      });
    }
  };

  if (isLoading) {
    return <LoadingState label="Cargando lead…" />;
  }

  if (!lead) {
    return (
      <PageContainer>
        <DetailHeader backTo={ROUTES.CRM_LEADS} backLabel="Leads" title="Lead no encontrado" />
        <ErrorState
          title="Lead no encontrado"
          description="El lead que buscas no existe o fue eliminado."
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <DetailHeader
        backTo={ROUTES.CRM_LEADS}
        backLabel="Leads"
        icon={<UserPlus className="h-6 w-6 text-accent shrink-0" />}
        title={lead.empresa}
        titleAs="h2"

        subtitle={`Lead · ${lead.fuente} · creado ${formatFechaEs(lead.created_at)}`}
        trailing={
          <LeadHeaderActions
            estado={lead.estado}
            canEdit={canEdit}
            onConvertir={() => setConvertirSheetOpen(true)}
            onEliminar={() => setDeleteOpen(true)}
          />
        }
      />


      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Contacto rápido</CardTitle>
        </CardHeader>
        <CardContent>
          <ContactActions
            email={lead.email}
            telefono={lead.telefono}
            plantillaCtx={{
              entidadTipo: "lead",
              entidadId: lead.id,
              vars: {
                contacto: lead.contacto || lead.empresa,
                empresa: lead.empresa,
                vendedor: lead.vendedor_email,
                etapa: lead.estado,
              },
            }}
          />
        </CardContent>
      </Card>

      <LeadDatosCard
        form={form}
        set={set}
        canEdit={canEdit}
        dirty={dirty}
        isSaving={actualizar.isPending}
        onSave={handleSave}
      />

      <LeadLineageCard leadId={lead.id} />

      <ActividadTimeline entidadTipo="lead" entidadId={lead.id} />

      <ConvertirLeadSheet
        open={convertirSheetOpen}
        onOpenChange={setConvertirSheetOpen}
        lead={lead}
        onAbrirAvanzado={() => setConvertirAvanzadoOpen(true)}
      />
      <ConvertirLeadDialog open={convertirAvanzadoOpen} onOpenChange={setConvertirAvanzadoOpen} lead={lead} />

      <DoubleConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        entityName={lead.empresa}
        onConfirm={handleDelete}
        isPending={eliminar.isPending}
      />
    </PageContainer>
  );
}
