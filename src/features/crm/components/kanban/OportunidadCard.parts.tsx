/**
 * Sub-vistas de `OportunidadCard` (v13.629.1): avance de criterios, meta y
 * próxima acción. Se extrajeron para bajar la complejidad de la tarjeta.
 */
import { Calendar, CheckCircle2, Target } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Hint } from "@/components/shared/Hint";
import { formatCurrencyCompact, fraccionAPorcentaje } from "@/lib/formatters";
import { formatFechaEs } from "@/lib/formatters/dates";
import { porcentajeCriterios, type AvanceCriterios } from "@/features/crm/domain/criterios";

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
        className={`text-label flex items-center gap-1 ${completo ? "text-success" : "text-warning"}`}
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
  moneda,
}: {
  vencida: boolean;
  fechaMeta: string | null;
  avance: number | null;
  montoMeta: number;
  moneda: string;
}) {
  const etiquetaFecha = fechaMeta ? `Meta ${formatFechaEs(fechaMeta)}` : "Meta";
  const etiquetaAvance =
    avance != null ? ` · ${fraccionAPorcentaje(avance)}% de ${formatCurrencyCompact(montoMeta, moneda)}` : "";
  const texto = `${etiquetaFecha}${etiquetaAvance}${vencida ? " · vencida" : ""}`;
  return (
    <div
      className={`text-label flex items-center gap-1 ${
        vencida ? "text-destructive" : "text-muted-foreground"
      }`}
    >
      <Target className="h-3 w-3 shrink-0" />
      {/* E-14: texto truncado sin forma de leerlo completo. */}
      <Hint label={texto}>
        <span className="truncate">{texto}</span>
      </Hint>
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
      className={`text-label flex items-center gap-1 truncate pt-1 border-t border-border/40 mt-1 ${
        vencida ? "text-destructive" : "text-muted-foreground"
      }`}
    >
      <Calendar className="h-3 w-3 shrink-0" />
      <Hint label={texto}>
        <span className="truncate">{texto}</span>
      </Hint>
    </div>
  );
}
