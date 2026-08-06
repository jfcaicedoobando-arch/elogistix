import { Activity, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DrillKpi } from "./_helpers";
import { SCORE_ESTADO_CONFIG, type ScoreEstado } from "./scoreEstadoConfig";
import type { RegresionScore } from "@/features/auditoria/domain/ejecutivoAgregados";

interface Props {
  score: number;
  scoreEstado: ScoreEstado;
  porSeveridad: { critico: number; alto: number; medio: number };
  regresion7d?: RegresionScore | null;
  onDrillSeveridad?: (sev: "critico" | "alto" | "medio") => void;
}

function RegresionBadge({ reg }: { reg: RegresionScore }) {
  const empeoro = reg.diferencia < 0;
  const sinCambio = reg.diferencia === 0;
  const Icono = sinCambio ? Minus : empeoro ? TrendingDown : TrendingUp;
  const tone = sinCambio
    ? "text-muted-foreground"
    : empeoro
      ? "text-destructive"
      : "text-success";
  const signo = reg.diferencia > 0 ? "+" : "";
  return (
    <Badge variant="outline" className={cn("gap-1", tone)} title={`vs. ${reg.fechaAnterior}`}>
      <Icono className="h-3 w-3" />
      {signo}{reg.diferencia} pts (7d)
    </Badge>
  );
}

export function EjecutivoScoreCard({
  score,
  scoreEstado,
  porSeveridad,
  regresion7d,
  onDrillSeveridad,
}: Props) {
  const cfg = SCORE_ESTADO_CONFIG[scoreEstado];
  return (
    <Card className="md:col-span-2">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Salud operativa
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end gap-3 flex-wrap">
          <div className={cn("text-5xl font-bold tabular-nums", cfg.text)}>{score}</div>
          <div className="text-sm text-muted-foreground pb-2">/ 100</div>
          <div className="ml-auto flex items-center gap-2">
            {regresion7d ? <RegresionBadge reg={regresion7d} /> : null}
            <Badge variant="outline" className={cn(cfg.text)}>
              {cfg.label}
            </Badge>
          </div>
        </div>
        <Progress value={score} className="h-2" />
        <p className="text-xs text-muted-foreground">{cfg.msg}</p>
        <div className="grid grid-cols-3 gap-3 pt-1 text-center">
          <DrillKpi
            label="Críticos"
            value={porSeveridad.critico}
            tone="text-destructive"
            onClick={onDrillSeveridad ? () => onDrillSeveridad("critico") : undefined}
          />
          <DrillKpi
            label="Altos"
            value={porSeveridad.alto}
            tone="text-warning"
            onClick={onDrillSeveridad ? () => onDrillSeveridad("alto") : undefined}
          />
          <DrillKpi
            label="Medios"
            value={porSeveridad.medio}
            tone="text-primary"
            onClick={onDrillSeveridad ? () => onDrillSeveridad("medio") : undefined}
          />
        </div>
      </CardContent>
    </Card>
  );
}

