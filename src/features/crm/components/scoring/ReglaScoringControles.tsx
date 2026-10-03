/** Controles de una regla; DataTable es dueño de la fila y las celdas. */
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useActualizarRegla, useEliminarRegla } from "@/features/crm/hooks/useScoringCrm";
import type { ReglaScoring } from "@/features/crm/services/scoring/reglasScoringCrm";

export function ReglaScoringPuntos({ regla }: { regla: ReglaScoring }) {
  const actualizar = useActualizarRegla();
  const [puntos, setPuntos] = useState(String(regla.puntos));
  const guardar = () => {
    const n = Number(puntos);
    if (n === regla.puntos) return;
    actualizar.mutate({ id: regla.id, cambio: { puntos: n } }, { onError: () => setPuntos(String(regla.puntos)) });
  };
  return <Input type="number" min={0} max={100} className="w-20" aria-label={`Puntos de ${regla.criterio}`}
    disabled={actualizar.isPending} value={puntos} onChange={(e) => setPuntos(e.target.value)} onBlur={guardar} />;
}

export function ReglaScoringActiva({ regla }: { regla: ReglaScoring }) {
  const actualizar = useActualizarRegla();
  return <Switch checked={regla.activa} aria-label={`Regla activa: ${regla.criterio}`} disabled={actualizar.isPending}
    onCheckedChange={(v) => actualizar.mutate({ id: regla.id, cambio: { activa: v } })} />;
}

export function ReglaScoringEliminar({ regla }: { regla: ReglaScoring }) {
  const eliminar = useEliminarRegla();
  return <Button variant="ghost" size="icon" aria-label={`Eliminar regla: ${regla.criterio}`} disabled={eliminar.isPending}
    onClick={() => eliminar.mutate(regla.id)}><Trash2 className="size-4" /></Button>;
}
