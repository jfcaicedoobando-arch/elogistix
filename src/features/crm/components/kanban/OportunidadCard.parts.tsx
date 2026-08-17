/**
 * Sub-vistas de `OportunidadCard` (v13.629.1): avance de criterios, meta y
 * próxima acción. Se extrajeron para bajar la complejidad de la tarjeta.
 */
import { Calendar, CheckCircle2, Target } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { formatCurrencyCompact } from "@/lib/formatters";
import { formatFechaEs } from "@/lib/formatters/dates";
import { porcentajeCriterios, type AvanceCriterios } from "@/features/crm/domain/criterios";
import type { ProximaActividad } from "@/features/crm/hooks";

const fmtMxn = (n: number) => formatCurrencyCompact(n, "MXN");

export function formatProx(prox: ProximaActividad | undefined): string {
  if (!prox) return "Sin próxima acción";
  if (!prox.fecha_programada) return prox.asunto;
  const d = new Date(prox.fecha_programada);
  const diff = Math.floor((d.getTime() - Date.now()) / 86_400_000);
  if (diff < 0) return `Vencida · ${prox.asunto}`;
  if (diff === 0) return `Hoy · ${prox.asunto}`;
  if (diff === 1) return `Mañana · ${prox.asunto}`;
  return `${formatFechaEs(prox.fecha_programada)} · ${prox.asunto}`;
}

export function CriteriosRow({
  avance,
  completo,
}: {
  avance: AvanceCriterios;
  completo: boolean;
}) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <Progress value={porcentajeCriterios(avance) * 100} className="h-1.5 flex-1" />
      <span
        className={`text-2xs flex items-center gap-1 ${completo ? "text-success" : "text-warning"}`}
      >
        {completo ? <CheckCircle2 className="h-3 w-3" /> : null}
        {avance.cumplidos}/{avance.total}
      </span>
    </div>
  );
}

export function MetaRow({
  vencida,
  fechaMeta,
  avance,
  montoMeta,
}: {
  vencida: boolean;
  fechaMeta: string | null;
  avance: number | null;
  montoMeta: number;
}) {
  const etiquetaFecha = fechaMeta ? `Meta ${formatFechaEs(fechaMeta)}` : "Meta";
  const etiquetaAvance =
    avance != null ? ` · ${Math.round(avance * 100)}% de ${fmtMxn(montoMeta)}` : "";
  return (
    <div
      className={`text-2xs flex items-center gap-1 ${
        vencida ? "text-destructive" : "text-muted-foreground"
      }`}
    >
      <Target className="h-3 w-3 shrink-0" />
      <span className="truncate">
        {etiquetaFecha}
        {etiquetaAvance}
        {vencida ? " · vencida" : ""}
      </span>
    </div>
  );
}

export function ProximaRow({
  texto,
  vencida,
}: {
  texto: string;
  vencida: boolean;
}) {
  return (
    <div
      className={`text-2xs flex items-center gap-1 truncate pt-1 border-t border-border/40 mt-1 ${
        vencida ? "text-destructive" : "text-muted-foreground"
      }`}
    >
      <Calendar className="h-3 w-3 shrink-0" />
      <span className="truncate">{texto}</span>
    </div>
  );
}
