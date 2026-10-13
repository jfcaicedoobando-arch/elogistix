import { describe, expect, it } from 'vitest';
import { calcularKPIsEjecutivos } from '../../services/alertas';
import { calcularVencimientosEjecutivos } from '../vencimientos';
import type { SnapshotEjecutivo } from '../../services/types';

function snapshot() {
  return {
    eerrPeriodo: { totalIngresos: { total: 0 }, totalCostos: { total: 100 }, utilidad: { total: -100 } },
    tesoreria: { saldo_bancos_mxn: 0, saldo_bancos_incompleto: true, flujo: { por_cobrar_total_mxn: 0, por_pagar_total_mxn: 0, flujo_incompleto: true } },
    vencimientos: { cobranzaMayor30: { total_mxn: 0, count: 1, excluido_por_moneda: { EUR: 100 } }, cxpProximos7: { total_mxn: 0, excluido_por_moneda: { EUR: 200 } } },
    presupuesto: { total_presupuesto_mxn: 100, total_real_mxn: 0, gastos_sin_tc_count: 1, real_truncado: false },
  } as unknown as Parameters<typeof calcularKPIsEjecutivos>[0];
}
describe('EX03/04/05 completitud ejecutiva',()=>{
  it('no declara caja agotada cuando la valuación bancaria está incompleta',()=>{
    const k = calcularKPIsEjecutivos(snapshot(),0);
    expect(k.runway_meses).toBeNull();
    expect(k.saldo_bancos_incompleto).toBe(true);
    expect(k.cartera_vencida_incompleta).toBe(true);
    expect(k.cxp_7dias_incompleto).toBe(true);
    expect(k.presupuesto_incompleto).toBe(true);
    expect(k.tiene_presupuesto).toBe(true);
    expect(k.dpo_dias).toBeNull();
  });
  it('propaga también el truncamiento del real',()=>{
    const s=snapshot(); s.presupuesto.gastos_sin_tc_count=0; s.presupuesto.real_truncado=true;
    expect(calcularKPIsEjecutivos(s,0).presupuesto_incompleto).toBe(true);
  });
  it('no publica ratios exactos de EERR incompleto',()=>{
    const s=snapshot(); s.eerrPeriodo={...s.eerrPeriodo, valuacion:{completa:false,conceptos_sin_tc_count:1,excluidos_sin_tc:[]}} as SnapshotEjecutivo['eerrPeriodo'];
    expect(calcularKPIsEjecutivos(s,0).eerr_incompleto).toBe(true);
    expect(calcularKPIsEjecutivos(s,0).runway_meses).toBeNull();
  });
  it('no calcula variaciones contra un mes previo parcial',()=>{
    const s=snapshot();
    const previo={...s.eerrPeriodo, valuacion:{completa:false,conceptos_sin_tc_count:1,excluidos_sin_tc:[]}} as SnapshotEjecutivo['eerrPeriodo'];
    const k=calcularKPIsEjecutivos(s,100,previo);
    expect(k.ingresos_delta_pct).toBeNull(); expect(k.utilidad_delta_pct).toBeNull(); expect(k.margen_delta_puntos).toBeNull();
  });
  it('ordena top cinco por MXN equivalente sin perder saldo nominal',()=>{
    const rows=Array.from({length:5},(_,i)=>({id:`m${i}`,numero:`m${i}`,cliente_nombre:`MXN${i}`,moneda:'MXN',saldo:100,fecha_vencimiento:'2026-01-01'}));
    rows.push({id:'usd',numero:'usd',cliente_nombre:'USD mayor',moneda:'USD',saldo:90,fecha_vencimiento:'2026-01-01'});
    const r=calcularVencimientosEjecutivos({cobranza:rows,cxp:[],tasas:{usdMxn:20},hoy:new Date(2026,9,1)}).cobranzaMayor30;
    expect(r.total_mxn).toBe(2300); expect(r.top[0]).toMatchObject({nombre:'USD mayor',saldo:90,moneda:'USD',saldo_mxn:1800,tipo_cambio:20});
  });
  it('no ofrece ranking preciso ni recorta saldos desconocidos sin TC',()=>{
    const rows=Array.from({length:6},(_,i)=>({id:`m${i}`,numero:`m${i}`,cliente_nombre:`EUR${i}`,moneda:'EUR',saldo:100+i,fecha_vencimiento:'2026-01-01'}));
    const r=calcularVencimientosEjecutivos({cobranza:rows,cxp:[],hoy:new Date(2026,9,1)}).cobranzaMayor30;
    expect(r.ranking_completo).toBe(false); expect(r.sin_valuar).toHaveLength(6); expect(r.top).toHaveLength(0);
  });
});
