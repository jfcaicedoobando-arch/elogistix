import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/shared/KpiCard";
import { reglaShortLabel } from "@/features/auditoria/constants/auditoriaConfig";
import type { ReglaAuditoria } from "@/features/auditoria/types";

interface Props {
  porRegla: Record<ReglaAuditoria, number>;
}

export function EjecutivoPorReglaGrid({ porRegla }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle >Pendientes por regla de auditoría</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(Object.keys(porRegla) as ReglaAuditoria[]).map((r) => (
            <KpiCard
              key={r}
              label={reglaShortLabel(r)}
              value={porRegla[r]}
              className="shadow-none"
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
