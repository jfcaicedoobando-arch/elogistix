/**
 * /crm/leads/:id — Ficha de lead con edición en línea y eliminación.
 * Lógica de formulario en `useLeadEditForm`; subcomponentes en `components/crm/leadDetalle/`.
 *
 * v13.823.63: retirado el flujo heredado "Convertir lead". Los leads históricos
 * Convertidos sólo ofrecen "Ver conversión" (navegación de sólo lectura).
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
import { usePermissions, useDocumentTitle } from "@/hooks/shared";
import { LeadLineageCard } from "@/features/crm/components/LineageCard";
import ContactActions from "@/features/crm/components/ContactActions";
import ActividadTimeline from "@/features/crm/components/ActividadTimeline";
import LeadDatosCard from "@/features/crm/components/leadDetalle/LeadDatosCard";
import LeadIcpCard from "@/features/crm/components/leadDetalle/LeadIcpCard";
import LeadHeaderActions from "@/features/crm/components/leadDetalle/LeadHeaderActions";
import LeadGateProspectoDialog from "@/features/crm/components/leadDetalle/LeadGateProspectoDialog";
import LeadEtapaProspectoAviso from "@/features/crm/components/leadDetalle/LeadEtapaProspectoAviso";
import OportunidadesDelProspecto from "@/features/crm/components/leadDetalle/OportunidadesDelProspecto";
import NuevaOportunidadDialog from "@/features/crm/components/NuevaOportunidadDialog";
import { useLead } from "@/features/crm/hooks";
import { useLeadDetalleAcciones } from "@/features/crm/hooks/useLeadDetalleAcciones";
import { esProspecto, puedeCalificarse } from "@/features/crm/domain/leads/etapas";
import { useLeadEditForm } from "@/features/crm/hooks";
import { ROUTES } from "@/constants/routes";
import { formatFechaEs } from "@/lib/formatters/dates";

export default function LeadDetalle() {
  const { id } = useParams<{ id: string }>();
  const { canTomarLead, canGestionarLead, canAltaCliente, canCrearOportunidad } = usePermissions();
  const volver = useVolver(ROUTES.CRM_LEADS);
  const navigate = useNavigate();
  const { data: lead, isLoading } = useLead(id);
  useDocumentTitle(lead ? `Lead · ${lead.empresa}` : "Lead");
  const { form, set, dirty, patch } = useLeadEditForm(lead);
  const {
    handleSave, handleDelete, handleCalificar, handleTomar,
    guardando, eliminando, tomando, calificando,
    faltantesGate, cerrarGate,
  } = useLeadDetalleAcciones(id, lead ?? undefined, patch);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [nuevaOportunidadOpen, setNuevaOportunidadOpen] = useState(false);

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
            canEdit={puedeGestionar}
            onEliminar={() => setDeleteOpen(true)}
            onVerConversion={destinoConversion ? () => navigate(destinoConversion) : undefined}
            mostrarTomar={canTomarLead && !lead.vendedor_id && lead.estado !== "Convertido"}
            onTomar={handleTomar}
            tomando={tomando}
            mostrarCalificar={!!lead.vendedor_id && puedeGestionar && puedeCalificarse(lead.estado)}
            onCalificar={handleCalificar}
            calificando={calificando}
            mostrarNuevaOportunidad={puedeGestionar && canCrearOportunidad && esProspecto(lead.estado)}
            onNuevaOportunidad={() => setNuevaOportunidadOpen(true)}
          />
        }
      />


      <LeadEtapaProspectoAviso estado={lead.estado} canAltaCliente={canAltaCliente} />

      <LeadDatosCard
        form={form}
        set={set}
        canEdit={puedeGestionar}
        dirty={dirty}
        isSaving={guardando}
        onSave={handleSave}
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

      <LeadLineageCard leadId={lead.id} />

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
