/**
 * Card de Perfil ICP del lead (Etapa 1 CRM Hunter).
 * Guarda con la misma mutación de leads, usando el patch ICP normalizado.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { crmToast } from "@/features/crm/lib/crmToast";
import { useActualizarLead } from "@/features/crm/hooks";
import { useLeadIcpForm } from "@/features/crm/hooks/useLeadIcpForm";
import {
  completitudIcp, toLeadIcpPatch, type LeadIcpSource,
} from "@/features/crm/domain/leads/icp";
import LeadIcpFields from "./LeadIcpFields";
import LeadIcpContactoFields from "./LeadIcpContactoFields";

interface Props {
  leadId: string;
  lead: LeadIcpSource;
  canEdit: boolean;
}

export default function LeadIcpCard({ leadId, lead, canEdit }: Props) {
  const actualizar = useActualizarLead();
  const { form, set, dirty } = useLeadIcpForm(lead, leadId);
  const completitud = Math.round(completitudIcp(form) * 100);

  const handleSave = async () => {
    try {
      await actualizar.mutateAsync({
        id: leadId,
        patch: toLeadIcpPatch(form),
      });
      crmToast.success("Perfil ICP guardado");
    } catch {
      // useActualizarLead ya notifica el error en onError.
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Perfil ICP</CardTitle>
        <div className="flex items-center gap-3">
          <div className="w-28">
            <Progress value={completitud} />
          </div>
          <Badge variant={completitud === 100 ? "default" : "outline"}>
            {completitud}% completo
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <LeadIcpContactoFields form={form} set={set} canEdit={canEdit} />
          <LeadIcpFields form={form} set={set} canEdit={canEdit} />
        </div>
        {canEdit && (
          <div className="flex justify-end mt-4">
            <Button onClick={handleSave} disabled={!dirty} loading={actualizar.isPending}>
              Guardar perfil ICP
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
