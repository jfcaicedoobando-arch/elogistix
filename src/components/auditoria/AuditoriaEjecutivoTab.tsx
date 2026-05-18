/**
 * Vista ejecutiva del módulo de Auditoría — compositor delgado.
 *
 * Pensada para el director general / dirección de operaciones: NO lista
 * hallazgos individuales; expone salud operativa, distribuciones y rankings
 * accionables. La pestaña "Detalle operativo" sigue conservando el desglose
 * tradicional para los operadores.
 */
import { Skeleton } from "@/components/ui/skeleton";
import type { AuditoriaEjecutivoData } from "@/hooks/auditoria";
import { useAutoCapturarSnapshot } from "@/hooks/auditoria";
import { AuditoriaTendenciaChart } from "./AuditoriaTendenciaChart";
import { AuditoriaOperadoresCard } from "./AuditoriaOperadoresCard";
import { AuditoriaRiesgoFinancieroCard } from "./AuditoriaRiesgoFinancieroCard";
import { EjecutivoScoreCard } from "./ejecutivo/EjecutivoScoreCard";
import { EjecutivoAtencionCard } from "./ejecutivo/EjecutivoAtencionCard";
import { EjecutivoAlertasUrgencia } from "./ejecutivo/EjecutivoAlertasUrgencia";
import { EjecutivoDistribucionRow } from "./ejecutivo/EjecutivoDistribucionRow";
import { EjecutivoPorReglaGrid } from "./ejecutivo/EjecutivoPorReglaGrid";

interface Props {
  data: AuditoriaEjecutivoData;
  /** Permite saltar a la pestaña de detalle con un filtro pre-aplicado. */
  onDrillDown?: (filtro: {
    severidad?: "critico" | "alto" | "medio";
    cliente?: string;
    etapa?: string;
    soloVencidos?: boolean;
  }) => void;
}

export function AuditoriaEjecutivoTab({ data, onDrillDown }: Props) {
  // Captura idempotente del snapshot del día (UNIQUE org+fecha en BD).
  useAutoCapturarSnapshot(!data.isLoading);

  if (data.isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-40 md:col-span-2" />
          <Skeleton className="h-40" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <EjecutivoScoreCard
          score={data.score}
          scoreEstado={data.scoreEstado}
          porSeveridad={data.porSeveridad}
          onDrillSeveridad={(sev) => onDrillDown?.({ severidad: sev })}
        />
        <EjecutivoAtencionCard
          porcentajeAtendidos={data.porcentajeAtendidos}
          totalRevisados={data.totalRevisados}
          totalPendientes={data.totalPendientes}
          edadPromediaPendientesDias={data.edadPromediaPendientesDias}
        />
      </div>

      <EjecutivoAlertasUrgencia
        pendientesVencidos={data.pendientesVencidos}
        pendientesUrgentesPorEta={data.pendientesUrgentesPorEta}
        onRevisarVencidos={() => onDrillDown?.({ soloVencidos: true })}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AuditoriaRiesgoFinancieroCard
          total={data.riesgoFinancieroMxn}
          porRegla={data.riesgoPorRegla}
        />
        <AuditoriaTendenciaChart />
      </div>

      <AuditoriaOperadoresCard
        mttrHoras={data.mttrHoras}
        ranking={data.rankingOperadores}
      />

      <EjecutivoDistribucionRow
        porEtapa={data.porEtapa}
        topClientes={data.topClientes}
        onDrillEtapa={(etapa) => onDrillDown?.({ etapa })}
        onDrillCliente={(cliente) => onDrillDown?.({ cliente })}
      />

      <EjecutivoPorReglaGrid porRegla={data.porRegla} />
    </div>
  );
}
