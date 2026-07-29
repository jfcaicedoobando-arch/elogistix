/**
 * Subcomponente de resultados (loading / error / vacío / grid) para
 * `SugerenciasTarifaInline`. Extraído para bajar la complejidad ciclomática.
 */
import { CardSkeleton } from "@/components/shared/skeletons";
import { ErrorStateInline } from "@/components/empty/ErrorStateInline";
import { TarifaResultCard } from "@/features/costeo/components/TarifaResultCard";
import type { TopTarifaRow } from "@/features/costeo/types";

interface Props {
  isFetching: boolean;
  error: unknown;
  isRefetching: boolean;
  tarifas: TopTarifaRow[];
  onRetry: () => void;
  onElegir: (row: TopTarifaRow) => void;
}

export function SugerenciasTarifaResultados({ isFetching, error, isRefetching, tarifas, onRetry, onElegir }: Props) {
  if (isFetching) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <CardSkeleton lines={4} />
        <CardSkeleton lines={4} />
        <CardSkeleton lines={4} />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorStateInline
        message={error instanceof Error ? error.message : "Error desconocido al consultar tarifas."}
        onRetry={onRetry}
        retrying={isRefetching}
      />
    );
  }

  if (tarifas.length === 0) {
    return (
      <p className="text-sm text-muted-foreground rounded-md border border-dashed p-3">
        No hay tarifas vigentes para esta combinación. Cotiza manualmente o
        captura una nueva en "Tarifas marítimas".
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {tarifas.map((t, i) => (
        <TarifaResultCard key={t.id} row={t} rank={i + 1} onElegir={onElegir} selectLabel="Elegir esta" />
      ))}
    </div>
  );
}
