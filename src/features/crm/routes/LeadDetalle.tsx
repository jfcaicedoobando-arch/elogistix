/**
 * /crm/leads/:id — Ficha de lead con edición en línea y eliminación.
 * Lógica de formulario en `useLeadEditForm`; subcomponentes en `components/crm/leadDetalle/`.
 *
 * v13.823.63: retirado el flujo heredado "Convertir lead". Los leads históricos
 * Convertidos sólo ofrecen "Ver conversión" (navegación de sólo lectura).
 */
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DetailHeader } from "@/components/shared/DetailHeader";
import { useVolver } from "@/hooks/shared/useVolver";
import { PageContainer } from "@/components/shared/PageContainer";
import { LoadingState } from "@/components/shared/states/LoadingState";
import { ErrorState } from "@/components/shared/states/ErrorState";
import DoubleConfirmDeleteDialog from "@/components/shared/DoubleConfirmDeleteDialog";
import { usePermissions, useDocumentTitle } from "@/hooks/shared";
import { LeadLineageCard } from "@/features/crm/components/LineageCard";
import ActividadTimeline from "@/features/crm/components/ActividadTimeline";
import LeadDatosCard from "@/features/crm/components/leadDetalle/LeadDatosCard";
import LeadIcpCard from "@/features/crm/components/leadDetalle/LeadIcpCard";
import LeadDetalleHeader from "@/features/crm/components/leadDetalle/LeadDetalleHeader";
import LeadGateProspectoDialog from "@/features/crm/components/leadDetalle/LeadGateProspectoDialog";
import LeadEtapaProspectoAviso from "@/features/crm/components/leadDetalle/LeadEtapaProspectoAviso";
import OportunidadesDelProspecto from "@/features/crm/components/leadDetalle/OportunidadesDelProspecto";
import NuevaOportunidadDialog from "@/features/crm/components/NuevaOportunidadDialog";
import { useLead } from "@/features/crm/hooks";
import { useLeadDetalleAcciones } from "@/features/crm/hooks/useLeadDetalleAcciones";
import { esProspecto } from "@/features/crm/domain/leads/etapas";
import type { CrmLeadEstado } from "@/features/crm/domain/leads/constants";
import { useLeadEditForm } from "@/features/crm/hooks";
import { ROUTES } from "@/constants/routes";

/** VIS-20260908-06: contexto de listado (Leads vs Prospectos) de la ficha. */
function contextoLead(estado: CrmLeadEstado | undefined) {
  const p = !!estado && esProspecto(estado);
  return {
    esProspecto: p,
    singular: p ? "Prospecto" : "Lead",
    plural: p ? "Prospectos" : "Leads",
    fallback: p ? ROUTES.CRM_PROSPECTOS : ROUTES.CRM_LEADS,
  };
}

export default function LeadDetalle() {
  const { id } = useParams<{ id: string }>();
  const { canTomarLead, canGestionarLead, canAltaCliente, canCrearOportunidad } = usePermissions();
  const navigate = useNavigate();
  const { data: lead, isLoading, isError, refetch } = useLead(id);
  // VIS-20260908-06: un prospecto se lista en /crm/prospectos; el letrero y el
  // destino de respaldo deben nombrar ese contexto (el regreso contextual por
  // historial ya funcionaba y se conserva).
  const ctx = contextoLead(lead?.estado);
  const contextoProspecto = ctx.esProspecto;
  const etiquetaContexto = ctx.plural;
  const volver = useVolver(ctx.fallback);
  useDocumentTitle(lead ? `${ctx.singular} · ${lead.empresa}` : "Lead");
  const { form, set, dirty, patch } = useLeadEditForm(lead);
  const {
    handleSave, handleDelete, handleCalificar, handleTomar,
    guardando, eliminando, tomando, calificando, errorEmail,
    faltantesGate, cerrarGate,
  } = useLeadDetalleAcciones(id, lead ?? undefined, patch);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [nuevaOportunidadOpen, setNuevaOportunidadOpen] = useState(false);

  if (isLoading) {
    return <LoadingState label="Cargando lead…" />;
  }

  if (isError) {
    return (
      <PageContainer>
        <DetailHeader backTo={volver} backLabel={`Volver a ${etiquetaContexto}`} titleAs="h2" title="Lead" />
        <ErrorState
          title="No se pudo cargar el lead"
          description="Revisa tu conexión e intenta de nuevo."
          onRetry={() => void refetch()}
        />
      </PageContainer>
    );
  }

  if (!lead) {
    return (
      <PageContainer>
        <DetailHeader backTo={volver} backLabel={`Volver a ${etiquetaContexto}`} titleAs="h2" title="Lead no encontrado" />
        <ErrorState
          title="Lead no encontrado"
          description="El lead que buscas no existe o fue eliminado."
        />
      </PageContainer>
    );
  }

  // v13.823.60 — capacidad POR FILA: el servidor exige rol in-org y, para
  // vendedor, `vendedor_id = auth.uid()`. `canEdit` global ya no decide.
  const puedeGestionar = canGestionarLead(lead.vendedor_id);

  // v13.823.63 — destino de sólo lectura para leads históricos Convertidos:
  // se prefiere la oportunidad y, si no existe, el cliente. Sin destino no se
  // muestra acción (la información sigue visible en LeadLineageCard).
  const destinoConversion = lead.oportunidad_convertida_id
    ? `${ROUTES.CRM_OPORTUNIDADES}/${lead.oportunidad_convertida_id}`
    : lead.cliente_convertido_id
      ? `${ROUTES.CLIENTES}/${lead.cliente_convertido_id}`
      : null;

  return (

    <PageContainer>
      <LeadDetalleHeader
        lead={lead}
        volver={volver}
        volverLabel={`Volver a ${etiquetaContexto}`}
        puedeGestionar={puedeGestionar}
        canTomarLead={canTomarLead}
        canCrearOportunidad={canCrearOportunidad}
        esProspecto={contextoProspecto}
        destinoConversion={destinoConversion}
        onNavegarConversion={(destino) => navigate(destino)}
        onEliminar={() => setDeleteOpen(true)}
        onTomar={handleTomar}
        tomando={tomando}
        onCalificar={handleCalificar}
        calificando={calificando}
        onNuevaOportunidad={() => setNuevaOportunidadOpen(true)}
      />



      <LeadEtapaProspectoAviso estado={lead.estado} canAltaCliente={canAltaCliente} />

      <LeadDatosCard
        form={form}
        set={set}
        canEdit={puedeGestionar}
        dirty={dirty}
        isSaving={guardando}
        onSave={handleSave}
        errorEmail={errorEmail}
      />

      <div id="lead-perfil-icp">
        <LeadIcpCard leadId={lead.id} lead={lead} canEdit={puedeGestionar} />
      </div>


      <LeadGateProspectoDialog
        open={faltantesGate.length > 0}
        onOpenChange={(v) => { if (!v) cerrarGate(); }}
        faltantes={faltantesGate}
        onIrAlPerfil={() => {
          document.getElementById("lead-perfil-icp")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
      />

      {esProspecto(lead.estado) && (
        <OportunidadesDelProspecto
          leadId={lead.id}
          canEdit={puedeGestionar && canCrearOportunidad}
          onNuevaOportunidad={() => setNuevaOportunidadOpen(true)}
        />
      )}

      {!esProspecto(lead.estado) && <LeadLineageCard leadId={lead.id} />}

      <ActividadTimeline entidadTipo="lead" entidadId={lead.id} />

      <NuevaOportunidadDialog
        open={nuevaOportunidadOpen}
        onOpenChange={setNuevaOportunidadOpen}
        origenInicial={{
          tipo: "prospecto",
          id: lead.id,
          nombre: lead.empresa,
          // Ownership: la oportunidad nace a nombre del vendedor del
          // prospecto, no del usuario que la captura desde la ficha.
          vendedorId: lead.vendedor_id ?? null,
          vendedorEmail: lead.vendedor_email ?? null,
        }}
      />

      <DoubleConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        entityName={lead.empresa}
        onConfirm={handleDelete}
        isPending={eliminando}
      />
    </PageContainer>
  );
}
