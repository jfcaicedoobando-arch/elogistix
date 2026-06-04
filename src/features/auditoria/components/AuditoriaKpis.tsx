import { AlertTriangle, AlertCircle, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Props {
  critico: number;
  alto: number;
  medio: number;
}

const kpis = [
  {
    key: "critico" as const,
    label: "Críticos",
    icon: AlertCircle,
    accent: "text-destructive",
    ring: "ring-destructive/20",
    description: "Requieren atención inmediata",
  },
  {
    key: "alto" as const,
    label: "Altos",
    icon: AlertTriangle,
    accent: "text-amber-600 dark:text-amber-400",
    ring: "ring-amber-500/20",
    description: "Documentos faltantes en operación",
  },
  {
    key: "medio" as const,
    label: "Medios",
    icon: Info,
    accent: "text-primary",
    ring: "ring-primary/20",
    description: "Inconsistencias menores",
  },
];

export function AuditoriaKpis({ critico, alto, medio }: Props) {
  const values = { critico, alto, medio };
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {kpis.map(({ key, label, icon: Icon, accent, ring, description }) => (
        <Card key={key} className={cn("ring-1", ring)}>
          <CardContent className="p-5 flex items-start gap-4">
            <div className={cn("rounded-lg p-2 bg-muted/40", accent)}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                {label}
              </div>
              <div className={cn("text-2xl font-bold tabular-nums", accent)}>
                {values[key].toLocaleString("es-MX")}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 truncate">{description}</div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
