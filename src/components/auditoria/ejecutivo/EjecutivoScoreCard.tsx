import { Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DrillKpi } from "./_helpers";
import { SCORE_ESTADO_CONFIG, type ScoreEstado } from "./scoreEstadoConfig";

interface Props {
  score: number;
  scoreEstado: ScoreEstado;
  porSeveridad: { critico: number; alto: number; medio: number };
  onDrillSeveridad?: (sev: "critico" | "alto" | "medio") => void;
}

export function EjecutivoScoreCard({
  score,
  scoreEstado,
  porSeveridad,
  onDrillSeveridad,
}: Props) {
  const cfg = SCORE_ESTADO_CONFIG[scoreEstado];
  return (
    <Card className="md:col-span-2">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Salud operativa
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end gap-3">
          <div className={cn("text-5xl font-bold tabular-nums", cfg.text)}>{score}</div>
          <div className="text-sm text-muted-foreground pb-2">/ 100</div>
          <Badge variant="outline" className={cn("ml-auto", cfg.text)}>
            {cfg.label}
          </Badge>
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
