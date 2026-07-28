/**
 * Timeline vertical de la proforma: emitida → enviada → aceptada/rechazada →
 * facturada. Los hitos sin fecha se muestran apagados y la línea conectora
 * indica el avance. Recibe los campos ya normalizados por
 * `resolveProformaTimelineFields` para mantener este componente sin casts.
 */
import { Check, Send, FileCheck2, X, FileSpreadsheet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, nombreDesdeEmail } from "@/lib/formatters";
import { resumirEnvios } from "@/features/proformas/domain/proformaDetalleHelpers";
import type { ProformaTimelineFields } from "@/features/proformas/domain/proformaClienteEstado";
import type { ProformaEnvioLite } from "@/features/proformas/services";

interface Props {
  fechaEmision: string;
  operador: string | null | undefined;
  timeline: ProformaTimelineFields;
  envios?: ProformaEnvioLite[];
}

interface Hito {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  fecha: string | null;
  actor?: string | null;
  nota?: string | null;
  tone: "default" | "success" | "danger";
}

function buildHitos(
  fechaEmision: string,
  operador: string | null | undefined,
  t: ProformaTimelineFields,
  notaEnvios: string | null,
): Hito[] {
  const rechazada = !!t.rechazadaAt;
  const hitoFinal: Hito = rechazada
    ? { key: "rechazada", label: "Rechazada", icon: X, fecha: t.rechazadaAt, tone: "danger" }
    : { key: "aceptada", label: "Aceptada", icon: Check, fecha: t.aceptadaAt, actor: t.aceptadaPor, tone: "success" };
  return [
    { key: "emitida", label: "Emitida", icon: FileSpreadsheet, fecha: fechaEmision, actor: operador, tone: "default" },
    {
      key: "enviada",
      label: "Enviada al cliente",
      icon: Send,
      fecha: t.enviadaAt,
      actor: t.enviadaPor,
      nota: notaEnvios,
      tone: "default",
    },
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

export function TimelineProforma({ fechaEmision, operador, timeline, envios }: Props) {
  const resumen = resumirEnvios(envios);
  const notaEnvios =
    resumen.total > 1 ? `${resumen.total} envíos · último ${formatDate(resumen.ultimoAt)}` : null;
  const hitos = buildHitos(fechaEmision, operador, timeline, notaEnvios);
  const activos = hitos.filter((h) => h.fecha).length;
  if (activos === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Historial</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="space-y-0">
          {hitos.map((h, i) => {
            const done = !!h.fecha;
            const Icon = h.icon;
            const bg = toneClass(done, h.tone);
            const esUltimo = i === hitos.length - 1;
            return (
              <li key={h.key} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${bg}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  {!esUltimo && (
                    <span
                      className={`w-px flex-1 min-h-[1.25rem] ${done ? "bg-primary/30" : "bg-border"}`}
                      aria-hidden="true"
                    />
                  )}
                </div>
                <div className={`min-w-0 ${esUltimo ? "pb-0" : "pb-4"}`}>
                  <p className="text-sm font-medium">{h.label}</p>
                  <p className={`text-xs ${done ? "text-foreground" : "text-muted-foreground"}`}>
                    {done ? formatDate(h.fecha) : "Pendiente"}
                  </p>
                  {done && h.actor && (
                    <p className="text-xs text-muted-foreground truncate" title={h.actor}>
                      {nombreDesdeEmail(h.actor)}
                    </p>
                  )}
                  {done && h.nota && (
                    <p className="text-xs text-muted-foreground truncate">{h.nota}</p>
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
