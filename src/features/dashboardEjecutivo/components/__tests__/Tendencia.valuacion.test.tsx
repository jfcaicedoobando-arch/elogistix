import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GraficoEERR12m } from '../GraficoEERR12m';
import { ForecastMultiMesChart } from '../ForecastMultiMesChart';
vi.mock('recharts',()=>({
 ResponsiveContainer: ({children}: {children: React.ReactNode}) => <div>{children}</div>,
 ComposedChart: () => <div data-testid="serie-conservada" />,
 Bar:()=>null,Line:()=>null,Area:()=>null,XAxis:()=>null,YAxis:()=>null,Tooltip:()=>null,Legend:()=>null,CartesianGrid:()=>null,
}));
const historico=Array.from({length:4},(_,i)=>({periodo:`2026-0${i+1}`,ingresos:100,costos:0,utilidad:100,valuacion:{completa:i!==1,conceptos_sin_tc_count:i===1?1:0,excluidos_sin_tc:[]}}));
describe('tendencia EERR parcial',()=>{
 it('histórico no verificado se conserva como referencia, pero no permite forecast',()=>{
   const desconocido=historico.map((p)=>({...p,valuacion:undefined,valuacion_no_verificada:true}));
   render(<><GraficoEERR12m data={desconocido}/><ForecastMultiMesChart historico={desconocido}/></>);
   expect(screen.getAllByRole('alert')).toHaveLength(2);
   expect(screen.getByTestId('serie-conservada')).toBeInTheDocument();
   expect(screen.getByText('Forecast no disponible: valuación histórica no verificada.')).toBeInTheDocument();
 });
 it('cero verificado conserva la tendencia y el forecast',()=>{
   const completos=historico.map((p)=>({...p,ingresos:0,costos:0,utilidad:0,valuacion:{completa:true,conceptos_sin_tc_count:0,excluidos_sin_tc:[]}}));
   render(<><GraficoEERR12m data={completos}/><ForecastMultiMesChart historico={completos}/></>);
   expect(screen.queryByRole('alert')).not.toBeInTheDocument();
   expect(screen.getAllByTestId('serie-conservada')).toHaveLength(2);
 });
 it('no grafica cifras mensuales parciales como exactas',()=>{
   render(<GraficoEERR12m data={historico}/>);
   expect(screen.getByRole('alert')).toHaveTextContent('Valuación incompleta');
 });
 it('no proyecta ingresos de una serie con valuación incompleta',()=>{
   render(<ForecastMultiMesChart historico={historico}/>);
   expect(screen.getByRole('alert')).toHaveTextContent('Valuación incompleta');
 });
});
