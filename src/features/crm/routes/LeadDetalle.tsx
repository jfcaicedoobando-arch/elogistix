/**
 * /crm/leads/:id — Ficha de lead con edición en línea, eliminación y conversión.
 * Lógica de formulario en `useLeadEditForm`; subcomponentes en `components/crm/leadDetalle/`.
 */
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DetailHeader } from "@/components/shared/DetailHeader";
import { useVolver } from "@/hooks/shared/useVolver";
import { PageContainer } from "@/components/shared/PageContainer";
import { LoadingState } from "@/components/shared/states/LoadingState";
import { ErrorState } from "@/components/shared/states/ErrorState";
import DoubleConfirmDeleteDialog from "@/components/shared/DoubleConfirmDeleteDialog";
import { notifyError } from "@/lib/ui/appFeedback";
import { crmToast } from "@/features/crm/lib/crmToast";
import { usePermissions, useDocumentTitle } from "@/hooks/shared";
import ConvertirLeadDialog from "@/features/crm/components/ConvertirLeadDialog";
import ConvertirLeadSheet from "@/features/crm/components/ConvertirLeadSheet";
import { LeadLineageCard } from "@/features/crm/components/LineageCard";
import ContactActions from "@/features/crm/components/ContactActions";
import ActividadTimeline from "@/features/crm/components/ActividadTimeline";
import LeadDatosCard from "@/features/crm/components/leadDetalle/LeadDatosCard";
import LeadIcpCard from "@/features/crm/components/leadDetalle/LeadIcpCard";
import LeadHeaderActions from "@/features/crm/components/leadDetalle/LeadHeaderActions";
import LeadEtapaProspectoAviso from "@/features/crm/components/leadDetalle/LeadEtapaProspectoAviso";
import OportunidadesDelProspecto from "@/features/crm/components/leadDetalle/OportunidadesDelProspecto";
import NuevaOportunidadDialog from "@/features/crm/components/NuevaOportunidadDialog";
import { useActualizarLead, useCalificarProspecto, useEliminarLead, useLead, useTomarLead } from "@/features/crm/hooks";
import { esProspecto, faltantesGateProspecto, puedeCalificarse } from "@/features/crm/domain/leads/etapas";
import { useLeadEditForm } from "@/features/crm/hooks";
import { ROUTES } from "@/constants/routes";
import { formatFechaEs } from "@/lib/formatters/dates";

export default function LeadDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canEdit, canTomarLead } = usePermissions();
  const volver = useVolver(ROUTES.CRM_LEADS);
  const { data: lead, isLoading } = useLead(id);
  useDocumentTitle(lead ? `Lead · ${lead.empresa}` : "Lead");
  const actualizar = useActualizarLead();
  const eliminar = useEliminarLead();
  const tomar = useTomarLead();
  const calificar = useCalificarProspecto();

  const { form, set, dirty } = useLeadEditForm(lead);
  const [convertirSheetOpen, setConvertirSheetOpen] = useState(false);
  const [convertirAvanzadoOpen, setConvertirAvanzadoOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [nuevaOportunidadOpen, setNuevaOportunidadOpen] = useState(false);

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

  /**
   * Rediseño CRM (v13.766.0): gate Lead → Prospecto. Avisamos los faltantes
   * antes de llamar a la RPC para no gastar un viaje al servidor.
   */
  const handleCalificar = () => {
    if (!lead) return;
    const faltantes = faltantesGateProspecto(lead);
    if (faltantes.length > 0) {
      notifyError(undefined, {
        title: "Falta completar el perfil comercial",
        description: `Captura en el perfil ICP: ${faltantes.join(", ")}.`,
        method: "GATE_PROSPECTO",
      });
      return;
    }
    calificar.mutate(lead.id);
  };

  // Ola 6 · O6.1: tomar el lead de la bolsa común (asigna vendedor_id = yo).
  const handleTomar = () => {
    if (!lead) return;
    tomar.mutate({ id: lead.id, empresa: lead.empresa });
  };

  if (isLoading) {
    return <LoadingState label="Cargando lead…" />;
  }

  if (!lead) {
    return (
      <PageContainer>
        <DetailHeader backTo={volver} backLabel="Volver a Leads" titleAs="h2" title="Lead no encontrado" />
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
        backTo={volver}
        backLabel="Volver a Leads"
        icon={<UserPlus className="h-6 w-6 text-accent shrink-0" />}
        title={lead.empresa}
        titleAs="h2"

        badge={<Badge variant="outline" className="capitalize">{lead.estado}</Badge>}
        subtitle={`Lead · ${lead.fuente} · creado ${formatFechaEs(lead.created_at)}`}
        meta={
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
        }
        trailing={
          <LeadHeaderActions
            estado={lead.estado}
            canEdit={canEdit}
            onConvertir={() => setConvertirSheetOpen(true)}
            onEliminar={() => setDeleteOpen(true)}
            mostrarTomar={canTomarLead && !lead.vendedor_id && lead.estado !== "Convertido"}
            onTomar={handleTomar}
            tomando={tomar.isPending}
            mostrarCalificar={canEdit && puedeCalificarse(lead.estado)}
            onCalificar={handleCalificar}
            calificando={calificar.isPending}
            mostrarNuevaOportunidad={canEdit && esProspecto(lead.estado)}
            onNuevaOportunidad={() => setNuevaOportunidadOpen(true)}
          />
        }
      />


      <LeadEtapaProspectoAviso estado={lead.estado} canAltaCliente={canEdit} />

      <LeadDatosCard
        form={form}
        set={set}
        canEdit={canEdit}
        dirty={dirty}
        isSaving={actualizar.isPending}
        onSave={handleSave}
      />

      <LeadIcpCard leadId={lead.id} lead={lead} canEdit={canEdit} />

      {esProspecto(lead.estado) && (
        <OportunidadesDelProspecto
          leadId={lead.id}
          canEdit={canEdit}
          onNuevaOportunidad={() => setNuevaOportunidadOpen(true)}
        />
      )}

      <LeadLineageCard leadId={lead.id} />

      <ActividadTimeline entidadTipo="lead" entidadId={lead.id} />

      <ConvertirLeadSheet
        open={convertirSheetOpen}
        onOpenChange={setConvertirSheetOpen}
        lead={lead}
        onAbrirAvanzado={() => setConvertirAvanzadoOpen(true)}
      />
      <ConvertirLeadDialog open={convertirAvanzadoOpen} onOpenChange={setConvertirAvanzadoOpen} lead={lead} />

      <NuevaOportunidadDialog
        open={nuevaOportunidadOpen}
        onOpenChange={setNuevaOportunidadOpen}
        origenInicial={{ tipo: "prospecto", id: lead.id, nombre: lead.empresa }}
      />

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
