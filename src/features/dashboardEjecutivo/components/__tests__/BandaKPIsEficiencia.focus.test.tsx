import { StrictMode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BandaKPIsEficiencia } from '../BandaKPIsEficiencia';
import { buildFinancialAnalysis } from '../../services/financialAnalysis';

const analysis = buildFinancialAnalysis({organizationId: 'mock-a', selectedMonth: '2026-09',
  currentBalanceReference: '2026-10-13', currencyRows: [{moneda: 'MXN'}]});
const next = buildFinancialAnalysis({organizationId: 'mock-b', selectedMonth: '2026-08',
  currentBalanceReference: '2026-10-13', currencyRows: [{moneda: 'USD'}]});
const label = 'Eficiencia financiera por moneda';
function focusSummary() {
  const summary = screen.getByText('Datos necesarios para calcular los indicadores');
  summary.focus();
  expect(summary).toHaveFocus();
  return summary;
}

describe('financial analysis · stable focus through source transitions', () => {
  it.each(['error', 'loading', 'empty'] as const)('moves removed summary focus to the same region on %s, preserving it on recovery', state => {
    const {rerender} = render(<BandaKPIsEficiencia analysis={analysis}/>);
    const region = screen.getByRole('region', {name: label});
    const summary = focusSummary();
    const focus = vi.spyOn(region, 'focus');
    rerender(<BandaKPIsEficiencia analysis={state === 'empty' ? undefined : analysis}
      error={state === 'error' ? new Error('mock source failure') : null} loading={state === 'loading'}/>);
    expect(screen.getByRole('region', {name: label})).toBe(region);
    expect(summary.isConnected).toBe(false);
    expect(region).toHaveFocus();
    expect(focus).toHaveBeenCalledExactlyOnceWith({preventScroll: true});
    expect(screen.queryByText(/Mes seleccionado/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Sin consolidación cambiaria/)).not.toBeInTheDocument();
    rerender(<BandaKPIsEficiencia analysis={analysis}/>);
    expect(region).toHaveFocus();
    expect(focus).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Mes seleccionado: 2026-09/)).toBeInTheDocument();
  });
  it.each(['error', 'loading', 'empty'] as const)('keeps external focus across %s and recovery', state => {
    const view = (unavailable: boolean) => <><button>Outside action</button><BandaKPIsEficiencia
      analysis={state === 'empty' && unavailable ? undefined : analysis}
      loading={state === 'loading' && unavailable}
      error={state === 'error' && unavailable ? new Error('mock failure') : null}/></>;
    const {rerender} = render(view(false));
    focusSummary();
    const outside = screen.getByRole('button', {name: 'Outside action'});
    outside.focus();
    const focus = vi.spyOn(screen.getByRole('region', {name: label}), 'focus');
    rerender(view(true));expect(outside).toHaveFocus();
    rerender(view(false));expect(outside).toHaveFocus();expect(focus).not.toHaveBeenCalled();
  });
  it('does not capture focus on initial loading, error or recovery from BODY', () => {
    const {rerender} = render(<BandaKPIsEficiencia loading/>);
    const region = screen.getByRole('region', {name: label});const focus = vi.spyOn(region, 'focus');
    expect(document.body).toHaveFocus();
    rerender(<BandaKPIsEficiencia error={new Error('mock failure')}/>);
    rerender(<BandaKPIsEficiencia analysis={analysis}/>);
    expect(document.body).toHaveFocus();expect(focus).not.toHaveBeenCalled();
  });
  it('retains a connected summary on same-scope rerenders', () => {
    const {rerender} = render(<BandaKPIsEficiencia analysis={analysis}/>);
    const summary = focusSummary();const focus = vi.spyOn(screen.getByRole('region', {name: label}), 'focus');
    rerender(<BandaKPIsEficiencia analysis={{...analysis}}/>);
    expect(summary).toHaveFocus();expect(summary.isConnected).toBe(true);expect(focus).not.toHaveBeenCalled();
  });
  it('recovers focus when a currency disappears within the same scope', () => {
    const multiple = {...analysis, currencies: [...analysis.currencies, {...next.currencies[0]}]};
    const {rerender} = render(<BandaKPIsEficiencia analysis={multiple}/>);
    screen.getAllByText('Datos necesarios para calcular los indicadores')[1].focus();
    rerender(<BandaKPIsEficiencia analysis={analysis}/>);
    expect(screen.getByRole('region', {name: label})).toHaveFocus();
    expect(screen.queryByText(/USD ·/)).not.toBeInTheDocument();
  });
  it('retires the old organization content and open state even with the same currency', () => {
    const {rerender} = render(<BandaKPIsEficiencia analysis={analysis}/>);
    const summary = focusSummary();fireEvent.click(summary);expect(summary.parentElement).toHaveAttribute('open');
    rerender(<BandaKPIsEficiencia analysis={{...next, currencies: analysis.currencies}}/>);
    expect(summary.isConnected).toBe(false);
    expect(screen.getByRole('region', {name: label})).toHaveFocus();
    expect(screen.queryByText(/Mes seleccionado: 2026-09/)).not.toBeInTheDocument();
    expect(screen.getByText(/Mes seleccionado: 2026-08/)).toBeInTheDocument();
    expect(screen.getByText('Datos necesarios para calcular los indicadores').parentElement).not.toHaveAttribute('open');
  });
  it('does not move external focus on an organization change', () => {
    const view = (data: typeof analysis) => <><button>Outside action</button><BandaKPIsEficiencia analysis={data}/></>;
    const {rerender} = render(view(analysis));const outside = screen.getByRole('button', {name: 'Outside action'});outside.focus();
    rerender(view(next));expect(outside).toHaveFocus();expect(screen.queryByText(/MXN ·/)).not.toBeInTheDocument();
  });
  it('respects another control that receives focus during the error commit', () => {
    const view = (error?: Error) => <>{error && <button ref={node => {node?.focus();}}>Independent action</button>}
      <BandaKPIsEficiencia analysis={analysis} error={error}/></>;
    const {rerender} = render(view());focusSummary();
    rerender(view(new Error('mock failure')));
    expect(screen.getByRole('button', {name: 'Independent action'})).toHaveFocus();
  });
  it('leaves Tab and ShiftTab unhandled and keeps native summary reachable after recovery', () => {
    const {rerender} = render(<BandaKPIsEficiencia analysis={analysis}/>);
    focusSummary();rerender(<BandaKPIsEficiencia error={new Error('mock failure')}/>);
    const region = screen.getByRole('region', {name: label});expect(region).toHaveFocus();expect(region.tabIndex).toBe(-1);
    rerender(<BandaKPIsEficiencia analysis={analysis}/>);
    // jsdom does not implement browser Tab movement; check event cancellation and native controls.
    expect(fireEvent.keyDown(region, {key: 'Tab'})).toBe(true);
    const summary = focusSummary();expect(summary.tagName).toBe('SUMMARY');
    expect(fireEvent.keyDown(summary, {key: 'Tab', shiftKey: true})).toBe(true);
    fireEvent.click(summary);expect(summary.parentElement).toHaveAttribute('open');
  });
  it('handles the same removal in StrictMode without refocusing on recovery', () => {
    const {rerender} = render(<StrictMode><BandaKPIsEficiencia analysis={analysis}/></StrictMode>);
    focusSummary();const region = screen.getByRole('region', {name: label});const focus = vi.spyOn(region, 'focus');
    rerender(<StrictMode><BandaKPIsEficiencia analysis={analysis} error={new Error('mock failure')}/></StrictMode>);
    expect(region).toHaveFocus();rerender(<StrictMode><BandaKPIsEficiencia analysis={analysis}/></StrictMode>);
    expect(region).toHaveFocus();expect(focus).toHaveBeenCalledTimes(1);
  });
});
