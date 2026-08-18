/**
 * Subcomponente de resultados (loading / error / vacío / grid) para
 * `SugerenciasTarifaInline`. Extraído para bajar la complejidad ciclomática.
 */
import { FileSearch } from "lucide-react";
import { CardSkeleton } from "@/components/shared/skeletons";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { ErrorStateInline } from "@/components/empty/ErrorStateInline";
import { TarifaResultCard } from "@/features/costeo/components/TarifaResultCard";
import type { TopTarifaRow } from "@/features/costeo/types";
import { getErrorMessage } from "@/lib/errors";

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
        message={getErrorMessage(error)}
        onRetry={onRetry}
        retrying={isRefetching}
      />
    );
  }

  if (tarifas.length === 0) {
    return (
      <EmptyStateInline
        icon={FileSearch}
        message="No hay tarifas vigentes para esta combinación."
        hint='Cotiza manualmente o captura una nueva en "Tarifas marítimas".'
        className="rounded-md border border-dashed"
      />
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
