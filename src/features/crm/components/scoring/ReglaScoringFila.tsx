/** Una fila (escalón) de regla: condición legible, puntos editables, activar y borrar. */
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { TableCell, TableRow } from "@/components/ui/table";
import { useActualizarRegla, useEliminarRegla } from "@/features/crm/hooks/useScoringCrm";
import type { ReglaScoring } from "@/features/crm/services/scoring/reglasScoringCrm";
import { describirCondicion } from "@/features/crm/services/scoring/describirRegla";

interface Props { regla: ReglaScoring; etiquetaOpcion?: string }

export function ReglaScoringFila({ regla, etiquetaOpcion }: Props) {
  const actualizar = useActualizarRegla();
  const eliminar = useEliminarRegla();
  const [puntos, setPuntos] = useState(String(regla.puntos));
  const guardarPuntos = () => {
    const n = Number(puntos);
    if (n === regla.puntos) return;
    actualizar.mutate({ id: regla.id, cambio: { puntos: n } }, { onError: () => setPuntos(String(regla.puntos)) });
  };
  return (
    <TableRow className={regla.activa ? undefined : "opacity-60"}>
      <TableCell className="font-medium">{regla.criterio}</TableCell>
      <TableCell>{describirCondicion(regla, etiquetaOpcion)}</TableCell>
      <TableCell>
        <Input
          type="number" min={0} max={100} className="w-20" aria-label={`Puntos de ${regla.criterio}`}
          value={puntos} onChange={(e) => setPuntos(e.target.value)} onBlur={guardarPuntos}
        />
      </TableCell>
      <TableCell>
        <Switch
          checked={regla.activa} aria-label="Regla activa"
          onCheckedChange={(v) => actualizar.mutate({ id: regla.id, cambio: { activa: v } })}
        />
      </TableCell>
      <TableCell>
        <Button variant="ghost" size="icon" aria-label="Eliminar regla" disabled={eliminar.isPending}
          onClick={() => eliminar.mutate(regla.id)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
