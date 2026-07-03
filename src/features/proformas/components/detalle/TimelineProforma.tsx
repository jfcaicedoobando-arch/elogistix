/**
 * Timeline horizontal de estados de la proforma: emitida → enviada →
 * aceptada/rechazada → facturada. Los estados sin fecha se muestran apagados.
 * Recibe los campos ya normalizados por `resolveProformaTimelineFields`
 * para mantener este componente sin casts.
 */
import { Check, Send, FileCheck2, X, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, nombreDesdeEmail } from "@/lib/formatters";
import type { ProformaTimelineFields } from "@/features/proformas/domain/proformaClienteEstado";

interface Props {
  fechaEmision: string;
  operador: string | null | undefined;
  timeline: ProformaTimelineFields;
}

interface Hito {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  fecha: string | null;
  actor?: string | null;
  tone: "default" | "success" | "danger";
}

function buildHitos(fechaEmision: string, operador: string | null | undefined, t: ProformaTimelineFields): Hito[] {
  const rechazada = !!t.rechazadaAt;
  const hitoFinal: Hito = rechazada
    ? { key: "rechazada", label: "Rechazada", icon: X, fecha: t.rechazadaAt, tone: "danger" }
    : { key: "aceptada", label: "Aceptada", icon: Check, fecha: t.aceptadaAt, actor: t.aceptadaPor, tone: "success" };
  return [
    { key: "emitida", label: "Emitida", icon: FileText, fecha: fechaEmision, actor: operador, tone: "default" },
    { key: "enviada", label: "Enviada", icon: Send, fecha: t.enviadaAt, actor: t.enviadaPor, tone: "default" },
    hitoFinal,
    { key: "facturada", label: "Facturada", icon: FileCheck2, fecha: t.fechaFacturacion, tone: "success" },
  ];
}

function toneClass(done: boolean, tone: Hito["tone"]): string {
  if (!done) return "bg-muted text-muted-foreground";
  if (tone === "success") return "bg-accent/15 text-accent";
  if (tone === "danger") return "bg-destructive/15 text-destructive";
  return "bg-primary/15 text-primary";
}

export function TimelineProforma({ fechaEmision, operador, timeline }: Props) {
  const hitos = buildHitos(fechaEmision, operador, timeline);
  const activos = hitos.filter((h) => h.fecha).length;
  if (activos === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Historial</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {hitos.map((h) => {
            const done = !!h.fecha;
            const Icon = h.icon;
            const bg = toneClass(done, h.tone);
            return (
              <li key={h.key} className="flex items-start gap-3">
                <span className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${bg}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{h.label}</p>
                  <p className={`text-xs ${done ? "text-foreground" : "text-muted-foreground"}`}>
                    {done ? formatDate(h.fecha!) : "—"}
                  </p>
                  {done && h.actor && (
                    <p className="text-xs text-muted-foreground truncate" title={h.actor}>
                      {nombreDesdeEmail(h.actor)}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
