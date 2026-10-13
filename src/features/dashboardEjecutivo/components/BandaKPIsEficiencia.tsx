import { Clock, Hourglass, Waves } from 'lucide-react';
import { KpiCard } from '@/components/shared/KpiCard';
import { KpiStrip } from '@/components/shared/KpiStrip';
import { ANALYSIS_DATA_REQUIRED, type FinancialAnalysis } from '../services/financialAnalysis';

export function BandaKPIsEficiencia({analysis, loading = false, error}: {
  analysis?: FinancialAnalysis; loading?: boolean; error?: Error | null;
}) {
  if (error) return <p role="alert">DSO, DPO y runway: N/D. No se pudieron consultar las fuentes financieras: {error.message}</p>;
  if (loading) return <p role="status">DSO, DPO y runway: N/D. Consultando las fuentes financieras.</p>;
  if (!analysis) return <p role="status">DSO, DPO y runway: N/D. {ANALYSIS_DATA_REQUIRED}</p>;
  return <section aria-label="Eficiencia financiera por moneda" className="space-y-3">
    <p className="text-sm text-muted-foreground">
      Mes seleccionado: {analysis.selectedMonth}. Referencia de cartera actual: {analysis.currentBalanceReference}.
      {' '}Corte financiero y cierre contable sin verificar. Políticas aprobadas; datos pendientes de verificación.
    </p>
    {analysis.currencies.map(row => <div key={row.currency ?? 'unknown'} className="space-y-2">
      <h2 className="text-sm font-medium">{row.currency ?? 'Moneda sin identificar'} · Sin consolidación cambiaria</h2>
      <KpiStrip desktopCols={3}>
        <KpiCard label="DSO — Días de cobro" value="N/D" delta="Faltan cartera neta histórica y ventas propias a crédito documentadas." icon={Clock} />
        <KpiCard label="DPO — Días de pago" value="N/D" delta="Faltan cartera neta histórica y compras propias a crédito documentadas." icon={Hourglass} />
        <KpiCard label="Runway — Días de operación" value="N/D" delta="Faltan caja disponible conciliada y tres meses cerrados de flujos operativos." icon={Waves} />
      </KpiStrip>
      <p className="text-sm text-muted-foreground">
        DSO/DPO: promedio diario verificable o apertura/cierre como aproximación; método pendiente de evidencia.
        {' '}Runway: consumo neto operativo realizado, excluyendo inversión, financiación y terceros.
        {' '}Periodos solicitados: {analysis.comparisonPeriods.length
          ? analysis.comparisonPeriods.map(period => `${period.start} a ${period.end}`).join('; ')
          : 'N/D: falta organización, moneda o periodo válido'}.
      </p>
      <details className="text-sm">
        <summary className="cursor-pointer">Datos necesarios para calcular los indicadores</summary>
        {(['dso', 'dpo', 'runway'] as const).map(metric => <div key={metric}>
          <h3 className="font-medium">{metric.toUpperCase()}</h3>
          <ul className="list-disc pl-5">{row.metrics[metric].causes.map((cause, index) =>
            <li key={`${cause.code}-${index}`}>{cause.detail}</li>)}</ul>
        </div>)}
      </details>
    </div>)}
  </section>;
}
