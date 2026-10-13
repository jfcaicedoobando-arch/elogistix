import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BandaKPIsEficiencia } from '../BandaKPIsEficiencia';
import { buildFinancialAnalysis } from '../../services/financialAnalysis';
const analysis=buildFinancialAnalysis({organizationId:'mock-org',selectedMonth:'2026-09',currentBalanceReference:'2026-10-13',
 currencyRows:[{moneda:'USD'},{moneda:'MXN'}]});
describe('financial efficiency UI · honest unavailable states',()=>{
 it('shows N/D for each metric/currency, dates, method and approved policies',()=>{
  render(<BandaKPIsEficiencia analysis={analysis}/>);
  expect(screen.getAllByText('N/D')).toHaveLength(6);
  expect(screen.getByText(/Mes seleccionado: 2026-09/)).toHaveTextContent('2026-10-13');
  expect(screen.getAllByText(/Sin consolidación cambiaria/)).toHaveLength(2);
  expect(screen.getAllByText(/2026-07-01 a 2026-07-31/)).toHaveLength(2);
  expect(screen.getAllByText(/método pendiente de evidencia/)).toHaveLength(2);
  expect(screen.queryByText('Sin burn')).not.toBeInTheDocument();
  expect(screen.queryByText(/CxC 30d|CxP 30d|costos − ingresos|45 días/)).not.toBeInTheDocument();
 });
 it('missing/legacy snapshot never falls back to old ratios',()=>{
  render(<BandaKPIsEficiencia/>);
  expect(screen.getByRole('status')).toHaveTextContent('N/D');
  expect(screen.getByRole('status')).toHaveTextContent('Falta una fuente verificada');
 });
 it('exposes actionable causes with neutral states and native keyboard-accessible details',()=>{
  const {container}=render(<BandaKPIsEficiencia analysis={analysis}/>);
  expect(screen.getAllByText(/PPD, días de crédito/)).toHaveLength(4);
  expect(screen.getAllByText(/restricciones al corte/)).toHaveLength(2);
  expect(container.querySelectorAll('details > summary')).toHaveLength(2);
  expect(container.querySelector('.text-destructive')).toBeNull();
 });
});

describe('independent review · unavailable source states', () => {
 it('does not render retained analysis while source loading', () => {
  render(<BandaKPIsEficiencia analysis={analysis} loading/>);
  expect(screen.getByRole('status')).toHaveTextContent('Consultando las fuentes financieras');
  expect(screen.queryByText(/Mes seleccionado/)).not.toBeInTheDocument();
 });
 it('source failure stays distinct from empty data or no burn', () => {
  render(<BandaKPIsEficiencia analysis={analysis} error={new Error('bank unavailable')}/>);
  expect(screen.getByRole('alert')).toHaveTextContent('N/D');
  expect(screen.getByRole('alert')).toHaveTextContent('bank unavailable');
  expect(screen.queryByText(/Mes seleccionado/)).not.toBeInTheDocument();
 });
});
