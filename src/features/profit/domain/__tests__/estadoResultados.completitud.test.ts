import { describe, it, expect } from 'vitest';
import { buildEstadoResultados } from '../estadoResultados';
import { buildEstadoResultadosCsvRows } from '../../components/EstadoResultadosTable.helpers';
const emb = (id: string, modo = 'Marítimo', tc: number | null = null) => ({id, modo, tipo_cambio_usd: tc, tipo_cambio_eur: tc});
describe('EX01 / EX06: completeness and offsetting modes', () => {
  it('preserves nonzero mode balances even when consolidated total is zero', () => {
    const r = buildEstadoResultados([emb('a'), emb('b', 'Aéreo')], [], [
      {embarque_id:'a', concepto:'Costo', monto:100, moneda:'MXN'},
      {embarque_id:'b', concepto:'Costo', monto:-100, moneda:'MXN'},
    ]);
    expect(r.costos).toHaveLength(1);
    expect(r.totalCostos.porModo['Marítimo']).toBe(100);
    expect(r.totalCostos.porModo['Aéreo']).toBe(-100);
    expect(r.totalCostos.total).toBe(0);
  });
  it('propagates missing FX, signed original amount and shipment; rejects exact CSV', () => {
    const r = buildEstadoResultados([emb('a')], [{embarque_id:'a', descripcion:'Venta',total:1000,moneda:'MXN'}],
      [{embarque_id:'a',concepto:'Costo',monto:100,moneda:'USD'}]);
    expect(r.valuacion).toEqual({completa:false, conceptos_sin_tc_count:1, excluidos_sin_tc:[
      {embarque_id:'a',concepto:'Costo',nominal:100,moneda:'USD',seccion:'costos',modo:'Marítimo'},
    ]});
    expect(() => buildEstadoResultadosCsvRows(r)).toThrow(/incompleta/i);
  });
  it('marks supported valid FX complete and preserves exact CSV', () => {
    const r = buildEstadoResultados([emb('a','Marítimo',20)], [], [{embarque_id:'a',concepto:'Costo',monto:100,moneda:'USD'}]);
    expect(r.valuacion?.completa).toBe(true);
    expect(r.totalCostos.total).toBe(2000);
    expect(buildEstadoResultadosCsvRows(r)).toHaveLength(5);
  });
  it('retains exclusions even if opposite original amounts net to zero', () => {
    const r = buildEstadoResultados([emb('a')], [], [100,-100].map(monto=>({embarque_id:'a',concepto:'Costo',monto,moneda:'EUR'})));
    expect(r.valuacion?.conceptos_sin_tc_count).toBe(2);
    expect(r.valuacion?.completa).toBe(false);
    expect(r.valuacion?.excluidos_sin_tc.map(x=>x.nominal)).toEqual([100,-100]);
  });
  it('still hides rows that are zero in every mode', () => {
    const r = buildEstadoResultados([emb('a')], [], [100,-100].map(monto=>({embarque_id:'a',concepto:'Costo',monto,moneda:'MXN'})));
    expect(r.costos).toHaveLength(0);
  });
});
