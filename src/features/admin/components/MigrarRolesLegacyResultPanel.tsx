/**
 * Panel de "último resultado" tras ejecutar la migración de roles legacy.
 * Extraído de MigrarRolesLegacyCard para respetar el límite de 200 líneas.
 */
import { CheckCircle2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { formatFechaHora } from "@/lib/formatters/dates";
import type { MigrarRolesLegacyResult } from "@/features/admin/services/migrarRolesLegacy";

interface Props {
  result: MigrarRolesLegacyResult;
}

export function MigrarRolesLegacyResultPanel({ result }: Props) {
  const om = result.organization_members;
  const ur = result.user_roles;
  return (
    <Alert variant="success" className="p-3 text-body-sm space-y-1">
      <div className="flex items-center gap-1 font-semibold">
        <CheckCircle2 className="h-3.5 w-3.5 text-success" />
        Último resultado ({formatFechaHora(result.ejecutado_at)})
      </div>
      <ul className="list-disc pl-5 text-muted-foreground">
        <li>Total migrados: <strong>{result.total_migrados}</strong></li>
        <li>
          organization_members — admin→admin_org: {om.admin_a_admin_org}, operador→coordinador: {om.operador_a_coordinador_logistico}, viewer→customer_service: {om.viewer_a_customer_service}
        </li>
        <li>
          user_roles — admin→admin_org: {ur.admin_a_admin_org}, operador→coordinador: {ur.operador_a_coordinador_logistico}, viewer→customer_service: {ur.viewer_a_customer_service}
        </li>
      </ul>
    </Alert>
  );
}
