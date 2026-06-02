import type { EstadoFiltro } from "@/hooks/dashboard";
import { TimelineEstadosCard } from "./statusCards/TimelineEstadosCard";
import { ArribosCard, type ArribosEsteMes } from "./statusCards/ArribosCard";

interface Props {
  conteoPorEstado: Record<EstadoFiltro, number>;
  totalActivos: number;
  isLoading: boolean;
  arribosEsteMes: ArribosEsteMes;
  hideFinancials?: boolean;
}

export function DashboardStatusCards({
  conteoPorEstado,
  isLoading,
  arribosEsteMes,
  hideFinancials = false,
}: Props) {
  return (
    <div className="space-y-4">
      <TimelineEstadosCard conteoPorEstado={conteoPorEstado} isLoading={isLoading} />
      <ArribosCard arribosEsteMes={arribosEsteMes} isLoading={isLoading} hideFinancials={hideFinancials} />
    </div>
  );
}
