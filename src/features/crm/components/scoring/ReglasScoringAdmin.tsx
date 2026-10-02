/** Configuración del puntaje de un objeto: cortes, escalones existentes y alta. */
import { useMemo } from "react";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ErrorState } from "@/components/shared/states/ErrorState";
import { usePropiedadesCrm } from "@/features/crm/hooks/usePropiedadesCrm";
import { useReglasScoring } from "@/features/crm/hooks/useScoringCrm";
import type { ObjetoPuntaje } from "@/features/crm/services/scoring/scoringCrm";
import { CortesScoringEditor } from "./CortesScoringEditor";
import { NuevaReglaScoringForm } from "./NuevaReglaScoringForm";
import { ReglaScoringFila } from "./ReglaScoringFila";

export function ReglasScoringAdmin({ objeto }: { objeto: ObjetoPuntaje }) {
  const { data: reglas = [], isError, refetch } = useReglasScoring(objeto);
  const { data: props = [] } = usePropiedadesCrm(objeto);
  const opciones = useMemo(
    () => new Map(props.flatMap((p) => p.opciones.map((o) => [o.id, o.etiqueta] as const))),
    [props],
  );
  const maximo = useMemo(() => {
    const porCriterio = new Map<string, number>();
    for (const r of reglas) if (r.activa) porCriterio.set(r.criterio, Math.max(porCriterio.get(r.criterio) ?? 0, r.puntos));
    return [...porCriterio.values()].reduce((a, b) => a + b, 0);
  }, [reglas]);
  const siguienteOrden = (reglas.at(-1)?.orden ?? 0) + 1;

  if (isError) return <ErrorState title="No se pudieron cargar las reglas" onRetry={() => void refetch()} />;

  return (
    <div className="space-y-4">
      <CortesScoringEditor objeto={objeto} />
      <p className="text-body-sm text-muted-foreground">
        Cada criterio suma los puntos del escalón más alto que cumpla. Máximo posible hoy: <strong>{maximo}</strong>
        {maximo !== 100 && " (se recomienda que sume 100; el puntaje nunca pasa de 100)"}.
      </p>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Criterio</TableHead><TableHead>Condición</TableHead><TableHead>Puntos</TableHead>
              <TableHead>Activa</TableHead><TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {reglas.map((r) => (
              <ReglaScoringFila key={r.id} regla={r} etiquetaOpcion={r.opcion_id ? opciones.get(r.opcion_id) : undefined} />
            ))}
          </TableBody>
        </Table>
      </div>
      <NuevaReglaScoringForm objeto={objeto} orden={siguienteOrden} />
    </div>
  );
}
