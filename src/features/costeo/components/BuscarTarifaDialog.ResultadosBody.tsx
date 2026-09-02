/**
 * Cuerpo de resultados de BuscarTarifaDialog (estados vacío/carga/error/lista).
 * Extraído para respetar Power-of-10 (≤200 líneas por archivo).
 */
import { MapPinned } from "lucide-react";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { ErrorStateInline } from "@/components/empty/ErrorStateInline";
import { TarifasSinResultado } from "./TarifasSinResultado";
import { TarifaResultCard } from "./TarifaResultCard";
import { computeRankingMeta } from "@/features/costeo/utils/rankingLabels";
import type { TopTarifaRow } from "@/features/costeo/types";
import type { DiagnosticoTarifas } from "@/features/costeo/services/diagnosticoTarifas";
import { getErrorMessage } from "@/lib/errors";

export interface ResultadosBodyProps {
  origen: string;
  destino: string;
  tipo: string;
  isFetching: boolean;
  tarifas: TopTarifaRow[];
  error?: unknown;
  onRetry?: () => void;
  isRefetching?: boolean;
  onElegir?: (row: TopTarifaRow) => void;
  onOpenChange: (v: boolean) => void;
  selectLabel?: string;
  diagnostico?: DiagnosticoTarifas;
}

export function ResultadosBody({
  origen, destino, tipo, isFetching, tarifas, error, onRetry, isRefetching,
  onElegir, onOpenChange, selectLabel, diagnostico,
}: ResultadosBodyProps) {
  if (!origen || !destino || !tipo) {
    return (
      <EmptyStateInline
        icon={MapPinned}
        message="Selecciona origen, destino y tipo de contenedor para ver tarifas."
      />
    );
  }
  if (isFetching) {
    return <EmptyStateInline loading message="Buscando…" />;
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
    return <TarifasSinResultado diagnostico={diagnostico} />;
  }
  const meta = computeRankingMeta(tarifas);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-3">
      {tarifas.map((t, i) => (
        <TarifaResultCard
          key={t.id}
          row={t}
          rank={i + 1}
          meta={meta[i]}
          onElegir={onElegir ? (row) => { onElegir(row); onOpenChange(false); } : undefined}
          selectLabel={selectLabel}
        />
      ))}
    </div>
  );
}
