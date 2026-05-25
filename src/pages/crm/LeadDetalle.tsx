/**
 * /crm/leads/:id — Ficha de lead con edición en línea, eliminación y conversión.
 * Lógica de formulario en `useLeadEditForm`; subcomponentes en `components/crm/leadDetalle/`.
 */
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PageHeader";
import DoubleConfirmDeleteDialog from "@/components/shared/DoubleConfirmDeleteDialog";
import { useToast } from "@/hooks/shared/useToast";
import { notifySuccess, notifyError } from "@/lib/ui/appFeedback";
import { usePermissions } from "@/hooks/shared";
import ConvertirLeadDialog from "@/components/crm/ConvertirLeadDialog";
import { LeadLineageCard } from "@/components/crm/LineageCard";
import ContactActions from "@/components/crm/ContactActions";
import ActividadTimeline from "@/components/crm/ActividadTimeline";
import LeadDatosCard from "@/components/crm/leadDetalle/LeadDatosCard";
import LeadHeaderActions from "@/components/crm/leadDetalle/LeadHeaderActions";
import { useActualizarLead, useEliminarLead, useLead } from "@/hooks/crm";
import { useLeadEditForm } from "@/hooks/crm";

export default function LeadDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canEdit } = usePermissions();
  const { toast } = useToast();
  const { data: lead, isLoading } = useLead(id);
  const actualizar = useActualizarLead();
  const eliminar = useEliminarLead();

  const { form, set, dirty } = useLeadEditForm(lead);
  const [convertirOpen, setConvertirOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleSave = async () => {
    if (!id) return;
    try {
      await actualizar.mutateAsync({ id, patch: form });
      notifySuccess(toast, { title: "Cambios guardados" });
    } catch (e) {
      notifyError(toast, {
        title: "No se pudo guardar",
        description: e instanceof Error ? e.message : undefined,
      });
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await eliminar.mutateAsync(id);
      notifySuccess(toast, { title: "Lead eliminado" });
      navigate("/crm/leads");
    } catch (e) {
      notifyError(toast, {
        title: "No se pudo eliminar",
        description: e instanceof Error ? e.message : undefined,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="p-6 space-y-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/crm/leads")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Volver
        </Button>
        <p className="text-muted-foreground">Lead no encontrado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate("/crm/leads")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Leads
        </Button>
      </div>

      <PageHeader
        title={lead.empresa}
        description={`Lead · ${lead.fuente} · creado ${new Date(lead.created_at).toLocaleDateString("es-MX")}`}
        actions={
          <LeadHeaderActions
            estado={lead.estado}
            canEdit={canEdit}
            onConvertir={() => setConvertirOpen(true)}
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

      <ConvertirLeadDialog open={convertirOpen} onOpenChange={setConvertirOpen} lead={lead} />

      <DoubleConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        entityName={lead.empresa}
        onConfirm={handleDelete}
        isPending={eliminar.isPending}
      />
    </div>
  );
}
