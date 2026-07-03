/**
 * Timeline horizontal de estados de la proforma: emitida → enviada →
 * aceptada/rechazada → facturada. Los estados sin fecha se muestran apagados.
 */
import { Check, Send, FileCheck2, X, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, nombreDesdeEmail } from "@/lib/formatters";
import type { ProformaDetalleFull } from "@/features/proformas/services";

// SAFE-CAST: columnas nuevas aún no presentes en el tipo generado.
type ExtraFields = {
  enviada_at?: string | null;
  enviada_por?: string | null;
  aceptada_at?: string | null;
  aceptada_por?: string | null;
  rechazada_at?: string | null;
  fecha_facturacion?: string | null;
};

interface Props {
  proforma: ProformaDetalleFull;
}

interface Hito {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  fecha: string | null;
  actor?: string | null;
  tone: "default" | "success" | "danger";
}

export function TimelineProforma({ proforma }: Props) {
  const extra = proforma as unknown as ExtraFields;
  const rechazada = !!extra.rechazada_at;

  const hitos: Hito[] = [
    {
      key: "emitida",
      label: "Emitida",
      icon: FileText,
      fecha: proforma.fecha_emision,
      actor: proforma.operador,
      tone: "default",
    },
    {
      key: "enviada",
      label: "Enviada",
      icon: Send,
      fecha: extra.enviada_at ?? null,
      actor: extra.enviada_por,
      tone: "default",
    },
    rechazada
      ? {
          key: "rechazada",
          label: "Rechazada",
          icon: X,
          fecha: extra.rechazada_at ?? null,
          tone: "danger",
        }
      : {
          key: "aceptada",
          label: "Aceptada",
          icon: Check,
          fecha: extra.aceptada_at ?? null,
          actor: extra.aceptada_por,
          tone: "success",
        },
    {
      key: "facturada",
      label: "Facturada",
      icon: FileCheck2,
      fecha: extra.fecha_facturacion ?? null,
      tone: "success",
    },
  ];

  const activos = hitos.filter((h) => h.fecha).length;
  if (activos === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Historial</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {hitos.map((h) => {
            const done = !!h.fecha;
            const Icon = h.icon;
            const bg = !done
              ? "bg-muted text-muted-foreground"
              : h.tone === "success"
                ? "bg-accent/15 text-accent"
                : h.tone === "danger"
                  ? "bg-destructive/15 text-destructive"
                  : "bg-primary/15 text-primary";
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
