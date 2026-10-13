import { Component, createRef, type ReactNode } from 'react';
import { Clock, Hourglass, Waves } from 'lucide-react';
import { KpiCard } from '@/components/shared/KpiCard';
import { KpiStrip } from '@/components/shared/KpiStrip';
import { ANALYSIS_DATA_REQUIRED, type FinancialAnalysis } from '../services/financialAnalysis';

interface FocusBoundaryProps { contentKey: string; children: ReactNode }

/** Snapshot before DOM removal; an effect would see BODY after the summary disappears. */
class AnalysisFocusBoundary extends Component<FocusBoundaryProps, unknown, Element | null> {
  private region = createRef<HTMLElement>();
  private content = createRef<HTMLDivElement>();

  getSnapshotBeforeUpdate(): Element | null {
    const content = this.content.current;
    if (!content) return null;
    const focused = content.ownerDocument.activeElement;
    return focused && content.contains(focused) ? focused : null;
  }

  componentDidUpdate(_previous: FocusBoundaryProps, _state: unknown, previousFocus: Element | null) {
    const region = this.region.current;
    if (previousFocus?.isConnected === false && region && region.ownerDocument.activeElement === region.ownerDocument.body) {
      region.focus({preventScroll: true});
    }
  }

  render() {
    return <section ref={this.region} aria-label="Eficiencia financiera por moneda" tabIndex={-1}
      className="space-y-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <div ref={this.content} key={this.props.contentKey} className="space-y-3">{this.props.children}</div>
    </section>;
  }
}

export function BandaKPIsEficiencia({analysis, loading = false, error}: {
  analysis?: FinancialAnalysis; loading?: boolean; error?: Error | null;
}) {
  if (error) return <AnalysisFocusBoundary contentKey="error"><p role="alert">DSO, DPO y runway: N/D. No se pudieron consultar las fuentes financieras: {error.message}</p></AnalysisFocusBoundary>;
  if (loading) return <AnalysisFocusBoundary contentKey="loading"><p role="status">DSO, DPO y runway: N/D. Consultando las fuentes financieras.</p></AnalysisFocusBoundary>;
  if (!analysis) return <AnalysisFocusBoundary contentKey="empty"><p role="status">DSO, DPO y runway: N/D. {ANALYSIS_DATA_REQUIRED}</p></AnalysisFocusBoundary>;
  const contentKey = JSON.stringify([analysis.organizationId, analysis.selectedMonth, analysis.currentBalanceReference]);
  return <AnalysisFocusBoundary contentKey={contentKey}>
    <p className="text-body text-muted-foreground">
      Mes seleccionado: {analysis.selectedMonth}. Referencia de cartera actual: {analysis.currentBalanceReference}.
      {' '}Corte financiero y cierre contable sin verificar. Políticas aprobadas; datos pendientes de verificación.
    </p>
    {analysis.currencies.map(row => <div key={row.currency ?? 'unknown'} className="space-y-2">
      <h2 className="text-body font-medium">{row.currency ?? 'Moneda sin identificar'} · Sin consolidación cambiaria</h2>
      <KpiStrip desktopCols={3}>
        <KpiCard label="DSO — Días de cobro" value="N/D" delta="Faltan cartera neta histórica y ventas propias a crédito documentadas." icon={Clock} />
        <KpiCard label="DPO — Días de pago" value="N/D" delta="Faltan cartera neta histórica y compras propias a crédito documentadas." icon={Hourglass} />
        <KpiCard label="Runway — Días de operación" value="N/D" delta="Faltan caja disponible conciliada y tres meses cerrados de flujos operativos." icon={Waves} />
      </KpiStrip>
      <p className="text-body text-muted-foreground">
        DSO/DPO: promedio diario verificable o apertura/cierre como aproximación; método pendiente de evidencia.
        {' '}Runway: consumo neto operativo realizado, excluyendo inversión, financiación y terceros.
        {' '}Periodos solicitados: {analysis.comparisonPeriods.length
          ? analysis.comparisonPeriods.map(period => `${period.start} a ${period.end}`).join('; ')
          : 'N/D: falta organización, moneda o periodo válido'}.
      </p>
      <details className="text-body">
        <summary className="cursor-pointer">Datos necesarios para calcular los indicadores</summary>
        {(['dso', 'dpo', 'runway'] as const).map(metric => <div key={metric}>
          <h3 className="font-medium">{metric.toUpperCase()}</h3>
          <ul className="list-disc pl-5">{row.metrics[metric].causes.map((cause, index) =>
            <li key={`${cause.code}-${index}`}>{cause.detail}</li>)}</ul>
        </div>)}
      </details>
    </div>)}
  </AnalysisFocusBoundary>;
}
