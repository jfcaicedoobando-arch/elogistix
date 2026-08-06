import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import { DrilldownRow } from "@/components/shared/dataTable/DrilldownRow";
import type { AlertaEjecutiva, SeveridadAlerta } from "@/features/dashboardEjecutivo/services";

interface Props {
  alertas: AlertaEjecutiva[];
}

const ICONOS: Record<SeveridadAlerta, typeof Info> = {
  info: Info,
  warning: AlertTriangle,
  critica: AlertCircle,
};

const VARIANT: Record<SeveridadAlerta, "default" | "destructive" | "secondary"> = {
  info: "secondary",
  warning: "default",
  critica: "destructive",
};

export function AlertasPanel({ alertas }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Alertas</CardTitle>
      </CardHeader>
      <CardContent>
        {alertas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin alertas activas.</p>
        ) : (
          <ul className="space-y-3">
            {alertas.map((a) => {
              const Icon = ICONOS[a.severidad];
              const content = (
                <div className="flex items-start gap-2">
                  <Icon className="h-4 w-4 mt-0.5 shrink-0" />
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{a.titulo}</span>
                      <Badge variant={VARIANT[a.severidad]} className="text-2xs">
                        {a.severidad}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{a.descripcion}</p>
                  </div>
                </div>
              );
              return (
                <li key={a.id}>
                  {a.url ? (
                    <DrilldownRow
                      href={a.url}
                      ariaLabel={a.titulo}
                      className="block hover:bg-muted/50 -mx-2 px-2 py-1 rounded"
                    >
                      {content}
                    </DrilldownRow>
                  ) : content}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
