/**
 * Checklist de criterios de salida de la etapa actual de una oportunidad.
 * Marca / desmarca cumplimiento y muestra el avance de la etapa.
 */
import { CheckSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  useCriteriosEtapa,
  useCumplimientoOportunidad,
  useMarcarCriterio,
} from "@/features/crm/hooks/useCriteriosEtapa";

interface Props {
  oportunidadId: string;
  etapaId: string;
  etapaNombre?: string;
  canEdit: boolean;
}

export function CriteriosSalidaCard({ oportunidadId, etapaId, etapaNombre, canEdit }: Props) {
  const { data: criterios = [] } = useCriteriosEtapa(etapaId);
  const { data: cumplidos = [] } = useCumplimientoOportunidad(oportunidadId);
  const marcar = useMarcarCriterio(oportunidadId);

  const activos = criterios.filter((c) => c.activo);
  if (activos.length === 0) return null;

  const cumplidosSet = new Set(cumplidos.map((c) => c.criterio_id));
  const total = activos.length;
  const hechos = activos.filter((c) => cumplidosSet.has(c.id)).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CheckSquare className="h-4 w-4 text-muted-foreground" />
          Criterios de salida{etapaNombre ? ` · ${etapaNombre}` : ""}
          <Badge variant={hechos === total ? "default" : "secondary"} className="ml-auto">
            {hechos}/{total}
          </Badge>
        </CardTitle>
        <Progress value={(hechos / total) * 100} className="h-1.5" />
      </CardHeader>
      <CardContent className="space-y-2">
        {activos.map((c) => {
          const checked = cumplidosSet.has(c.id);
          return (
            <div key={c.id} className="flex items-start gap-2">
              <Checkbox
                id={`crit-${c.id}`}
                checked={checked}
                disabled={!canEdit || marcar.isPending}
                onCheckedChange={(v) => marcar.mutate({ criterioId: c.id, cumplido: v === true })}
              />
              <Label
                htmlFor={`crit-${c.id}`}
                size="sm"
                className={`cursor-pointer leading-tight ${checked ? "text-muted-foreground line-through" : ""}`}
              >
                {c.nombre}
                {c.obligatorio ? <span className="text-destructive"> *</span> : null}
              </Label>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
