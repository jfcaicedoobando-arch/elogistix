/** Configuración del puntaje de un objeto: cortes, escalones existentes y alta. */
import { useMemo } from "react";
import { DataTable, defineColumns } from "@/components/shared/DataTable";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";
import { ErrorState } from "@/components/shared/states/ErrorState";
import { usePropiedadesCrm } from "@/features/crm/hooks/usePropiedadesCrm";
import { useReglasScoring } from "@/features/crm/hooks/useScoringCrm";
import type { ObjetoPuntaje } from "@/features/crm/services/scoring/scoringCrm";
import { CortesScoringEditor } from "./CortesScoringEditor";
import { NuevaReglaScoringForm } from "./NuevaReglaScoringForm";
import { ReglaScoringPuntos, ReglaScoringActiva, ReglaScoringEliminar } from "./ReglaScoringControles";
import type { ReglaScoring } from "@/features/crm/services/scoring/reglasScoringCrm";
import { describirCondicion } from "@/features/crm/services/scoring/describirRegla";

export function ReglasScoringAdmin({ objeto }: { objeto: ObjetoPuntaje }) {
  const { data: reglas = [], isLoading, isError, refetch } = useReglasScoring(objeto);
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
        <DataTable data={reglas} rowKey={(r) => r.id} isLoading={isLoading} density={TABLE_DENSITY.embebida}
          emptyMessage="Aún no hay reglas configuradas." rowClassName={(r) => r.activa ? "" : "opacity-60"}
          columns={defineColumns<ReglaScoring>([
            { id: "criterio", header: "Criterio", accessorFn: (r) => r.criterio, meta: { className: "font-medium" } },
            { id: "condicion", header: "Condición", cell: ({ row }) => describirCondicion(row.original,
              row.original.opcion_id ? opciones.get(row.original.opcion_id) : undefined) },
            { id: "puntos", header: "Puntos", cell: ({ row }) => <ReglaScoringPuntos key={`${row.original.id}:${row.original.puntos}`} regla={row.original} /> },
            { id: "activa", header: "Activa", cell: ({ row }) => <ReglaScoringActiva regla={row.original} /> },
            { id: "acciones", header: "Acciones", cell: ({ row }) => <ReglaScoringEliminar regla={row.original} /> },
          ])} />
      </div>
      <NuevaReglaScoringForm objeto={objeto} orden={siguienteOrden} />
    </div>
  );
}
