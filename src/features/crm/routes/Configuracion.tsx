/**
 * /crm/configuracion — Etapas, motivos de pérdida y plantillas de mensaje.
 * Una sola vista con acordeones (sin sub-tabs).
 */
import { Settings } from "lucide-react";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import EtapasPipelineEditor from "@/features/crm/components/EtapasPipelineEditor";
import MotivosPerdidaEditor from "@/features/crm/components/MotivosPerdidaEditor";
import PlantillasMensajeEditor from "@/features/crm/components/PlantillasMensajeEditor";
import { usePermissions, useDocumentTitle } from "@/hooks/shared";

export default function CrmConfiguracion() {
  useDocumentTitle('Configuración del CRM');
  const { canEditCrm } = usePermissions();
  if (!canEditCrm) {
    return <div className="p-8 text-center text-sm text-muted-foreground">No tienes permiso para configurar el CRM.</div>;
  }
  return (
    <PageContainer>
      <PageHeader
        icon={<Settings className="h-6 w-6 text-primary" />}
        title="Configuración del CRM"
        description="Etapas del pipeline, motivos de pérdida y plantillas de mensajes."
      />
      <Accordion type="single" collapsible defaultValue="pipeline" className="w-full space-y-2">
        <AccordionItem value="pipeline" className="border rounded-md bg-card px-4">
          <AccordionTrigger className="text-sm font-semibold">Pipeline (etapas)</AccordionTrigger>
          <AccordionContent className="pt-2 pb-4">
            <EtapasPipelineEditor />
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="motivos" className="border rounded-md bg-card px-4">
          <AccordionTrigger className="text-sm font-semibold">Motivos de pérdida</AccordionTrigger>
          <AccordionContent className="pt-2 pb-4">
            <MotivosPerdidaEditor />
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="plantillas" className="border rounded-md bg-card px-4">
          <AccordionTrigger className="text-sm font-semibold">Plantillas de mensaje</AccordionTrigger>
          <AccordionContent className="pt-2 pb-4">
            <PlantillasMensajeEditor />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </PageContainer>
  );
}
