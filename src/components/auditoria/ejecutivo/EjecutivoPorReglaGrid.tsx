import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { reglaShortLabel } from "@/lib/ui/auditoriaConfig";
import type { ReglaAuditoria } from "@/types/auditoria";

interface Props {
  porRegla: Record<ReglaAuditoria, number>;
}

export function EjecutivoPorReglaGrid({ porRegla }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Pendientes por regla de auditoría</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(Object.keys(porRegla) as ReglaAuditoria[]).map((r) => (
            <div
              key={r}
              className="rounded-md border p-3 hover:bg-muted/30 transition-colors"
            >
              <div className="text-2xl font-bold tabular-nums">{porRegla[r]}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{reglaShortLabel(r)}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
