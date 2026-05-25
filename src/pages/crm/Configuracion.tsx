/**
 * /crm/configuracion — Etapas, motivos de pérdida y plantillas de mensaje.
 */
import { Settings } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/PageHeader";
import EtapasPipelineEditor from "@/components/crm/EtapasPipelineEditor";
import MotivosPerdidaEditor from "@/components/crm/MotivosPerdidaEditor";
import PlantillasMensajeEditor from "@/components/crm/PlantillasMensajeEditor";
import { usePermissions } from "@/hooks/shared";

export default function CrmConfiguracion() {
  const { canEditCrm } = usePermissions();
  if (!canEditCrm) {
    return <div className="p-8 text-center text-sm text-muted-foreground">No tienes permiso para configurar el CRM.</div>;
  }
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        icon={<Settings className="h-6 w-6 text-primary" />}
        title="Configuración del CRM"
        description="Etapas del pipeline, motivos de pérdida y plantillas de mensajes."
      />
      <Tabs defaultValue="pipeline" className="w-full">
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="motivos">Motivos de pérdida</TabsTrigger>
          <TabsTrigger value="plantillas">Plantillas</TabsTrigger>
        </TabsList>
        <TabsContent value="pipeline" className="space-y-4 mt-4">
          <EtapasPipelineEditor />
        </TabsContent>
        <TabsContent value="motivos" className="space-y-4 mt-4">
          <MotivosPerdidaEditor />
        </TabsContent>
        <TabsContent value="plantillas" className="space-y-4 mt-4">
          <PlantillasMensajeEditor />
        </TabsContent>
      </Tabs>
    </div>
  );
}
