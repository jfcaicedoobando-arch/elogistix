import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { BandaKPIs } from '../BandaKPIs';
import { BandaKPIsEficiencia } from '../BandaKPIsEficiencia';
import type { KPIsEjecutivos } from '../../services/types';
vi.mock('@/features/profit/components/BudgetOverrunSheet',()=>({BudgetOverrunSheet:()=>null}));
const base: KPIsEjecutivos = { ingresos_mxn:0, ingresos_delta_pct:null, utilidad_mxn:-100, utilidad_delta_pct:null, margen_pct:0, margen_delta_puntos:null, saldo_bancos_mxn:0, cartera_vencida_mxn:0, cartera_vencida_count:1, cxp_7dias_mxn:0,cumplimiento_presupuesto_pct:0,categorias_en_exceso:0,dso_dias:null,dpo_dias:null,runway_meses:null };
function banda(kpis: KPIsEjecutivos) { return render(<MemoryRouter><BandaKPIs kpis={kpis} periodo="2026-09" fuente="facturas" /></MemoryRouter>); }
describe('EX03/05 representación de datos incompletos',()=>{
 it('presupuesto capturado con gasto cero muestra ejecución 0%',()=>{
   banda({...base,tiene_presupuesto:true});
   expect(screen.getByText('0.0 %')).toBeInTheDocument();
   expect(screen.queryByText('Sin presupuesto capturado')).not.toBeInTheDocument();
 });
 it('ingresos cero conserva pérdida nominal y margen no calculable neutro',()=>{
   banda(base);
   expect(screen.getByText('Margen no calculable · ingresos en cero')).toHaveClass('text-muted-foreground');
   expect(screen.queryByText(/Margen 0.0%/)).not.toBeInTheDocument();
   expect(screen.getByText('MXN -100.00')).toBeInTheDocument();
 });
 it('presupuesto parcial no muestra ejecución exacta ni En rango',()=>{
   banda({...base,tiene_presupuesto:true,presupuesto_incompleto:true});
   expect(screen.getByText('No disponible')).toBeInTheDocument();
   expect(screen.getByText('Gasto real incompleto')).toHaveClass('text-muted-foreground');
   expect(screen.queryByText('En rango')).not.toBeInTheDocument();
 });
 it('bancos incompletos no aparecen como caja agotada o Sin burn',()=>{
   render(<BandaKPIsEficiencia />);
   expect(screen.getByRole('status')).toHaveTextContent('N/D');
   expect(screen.queryByText('Caja agotada')).not.toBeInTheDocument();
   expect(screen.queryByText('Sin burn')).not.toBeInTheDocument();
   expect(screen.getByRole('status')).toHaveTextContent('Falta una fuente verificada');
 });
 it('drilldown mantiene nominales no valuados fuera del ranking y sin recortar',()=>{
   render(<MemoryRouter><BandaKPIs kpis={{...base,cartera_vencida_incompleta:true}} periodo="2026-09" fuente="facturas" topDeudores={[]} deudoresSinValuar={Array.from({length:12},(_,i)=>({nombre:`Cliente EUR ${i}`,saldo:100,moneda:'EUR',saldo_mxn:null,tipo_cambio:null}))}/></MemoryRouter>);
   fireEvent.click(screen.getByText('Cobranza vencida (>30d)'));
   const sheet=screen.getByTestId('kpi-drilldown-sheet');
   expect(within(sheet).getByText(/Ranking incompleto/)).toBeInTheDocument();
   expect(within(sheet).getAllByText('Sin TC · sin posición')).toHaveLength(12);
   expect(within(sheet).queryByText('Sin cartera vencida hace más de 30 días.')).not.toBeInTheDocument();
 });
});
