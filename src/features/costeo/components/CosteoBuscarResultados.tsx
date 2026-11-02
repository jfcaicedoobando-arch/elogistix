import { MapPinned } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { LoadingState } from "@/components/shared/states/LoadingState";
import { ErrorState } from "@/components/shared/states/ErrorState";
import type { DiagnosticoTarifas } from "@/features/costeo/services/diagnosticoTarifas";
import type { TopTarifaRow } from "@/features/costeo/types";
import { computeRankingMeta } from "@/features/costeo/utils/rankingLabels";
import { TarifasSinResultado } from "./TarifasSinResultado";
import { TarifaResultCard } from "./TarifaResultCard";

interface Props {
  mismoPuerto: boolean;
  seleccionCompleta: boolean;
  tarifas: TopTarifaRow[];
  isFetching: boolean;
  isError: boolean;
  diagnostico?: DiagnosticoTarifas;
  onRetry: () => void;
}

/** Estados y ranking de una búsqueda, en el mismo orden de prioridad. */
export function CosteoBuscarResultados({
  mismoPuerto, seleccionCompleta, tarifas, isFetching, isError, diagnostico, onRetry,
}: Props) {
  if (mismoPuerto) {
    return (
      <Card className="p-4">
        <p className="text-body text-destructive" role="alert">
          El puerto de origen y el de destino deben ser distintos.
        </p>
      </Card>
    );
  }
  if (!seleccionCompleta) {
    return (
      <Card>
        <EmptyStateInline
          icon={MapPinned}
          message="Selecciona ruta y tipo de contenedor para ver las tarifas vigentes."
        />
      </Card>
    );
  }
  if (isFetching) {
    return <Card><LoadingState label="Buscando tarifas…" /></Card>;
  }
  if (isError) {
    return (
      <Card>
        <ErrorState
          title="No pudimos consultar las tarifas"
          description="Hubo un problema de conexión o del servidor. Esto no significa que no existan tarifas para esta ruta."
          onRetry={onRetry}
        />
      </Card>
    );
  }
  if (tarifas.length === 0) {
    return <Card><TarifasSinResultado diagnostico={diagnostico} /></Card>;
  }
  const meta = computeRankingMeta(tarifas);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {tarifas.map((tarifa, i) => (
        <TarifaResultCard key={tarifa.id} row={tarifa} rank={i + 1} meta={meta[i]} />
      ))}
    </div>
  );
}
