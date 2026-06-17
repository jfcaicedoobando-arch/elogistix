/**
 * Subcomponente presentacional: tarjeta del checklist de validaciones de cierre.
 * Extraído de `TabCierre.tsx` (Auditoría arquitectónica 13.56.6 / paso 15).
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle } from "lucide-react";

export interface CierreCheck {
  regla: string;
  ok: boolean;
  detalle?: unknown;
}

interface Props {
  isLoading: boolean;
  checks: CierreCheck[];
  etiquetas: Record<string, string>;
}

export function CierreChecklistCard({ isLoading, checks, etiquetas }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Checklist de cierre</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">Validando…</p>}
        {!isLoading && checks.length === 0 && (
          <p className="text-sm text-muted-foreground">Sin datos.</p>
        )}
        <ul className="space-y-2">
          {checks.map((c) => (
            <li
              key={c.regla}
              className="flex items-start justify-between gap-3 rounded-md border p-3"
            >
              <div className="flex items-start gap-2">
                {c.ok ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-success" />
                ) : (
                  <XCircle className="mt-0.5 h-5 w-5 text-destructive" />
                )}
                <div>
                  <p className="text-sm font-medium">{etiquetas[c.regla] ?? c.regla}</p>
                  {c.detalle != null && (
                    <p className="text-xs text-muted-foreground">
                      {JSON.stringify(c.detalle)}
                    </p>
                  )}
                </div>
              </div>
              <Badge variant={c.ok ? "secondary" : "destructive"}>
                {c.ok ? "OK" : "Pendiente"}
              </Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
