/**
 * /crm/configuracion — Etapas del pipeline y motivos de pérdida.
 */
import { Settings } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import EtapasPipelineEditor from "@/components/crm/EtapasPipelineEditor";
import MotivosPerdidaEditor from "@/components/crm/MotivosPerdidaEditor";
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
        description="Ajusta las etapas del pipeline y los motivos de pérdida."
      />
      <EtapasPipelineEditor />
      <MotivosPerdidaEditor />
    </div>
  );
}
