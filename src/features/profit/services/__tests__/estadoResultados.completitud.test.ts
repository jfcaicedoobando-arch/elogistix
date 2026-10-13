import { describe, expect, it, vi } from 'vitest';
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import('@/services/__tests__/_supabaseChainMock');
  return createSupabaseMock();
});
vi.mock('@/integrations/supabase/client', () => ({ supabase: mock.supabase }));
vi.mock('@/features/facturacion', () => ({fetchVentaFacturadaEmbarques: async () => [
  {embarque_id:'ex01',descripcion:'Venta facturada',total:1000,moneda:'MXN'},
]}));
import { fetchEstadoResultadosMes } from '../estadoResultados';

describe('EX01 operational service', () => {
  it('carries the missing cost FX through the real monthly calculation', async () => {
    mock.setTableResult('embarques', {data:[{id:'ex01',modo:'Marítimo',tipo_cambio_usd:null,tipo_cambio_eur:null,estado:'En tránsito'}],error:null});
    mock.setTableResult('conceptos_costo', {data:[{embarque_id:'ex01',concepto:'Flete',monto:100,moneda:'USD'}],error:null});
    const data = await fetchEstadoResultadosMes({organizationId:'test-org',year:2026,month:10});
    expect(data.totalIngresos.total).toBe(1000);
    expect(data.valuacion).toMatchObject({completa:false,conceptos_sin_tc_count:1,
      excluidos_sin_tc:[{embarque_id:'ex01',concepto:'Flete',nominal:100,moneda:'USD',seccion:'costos'}],
    });
  });
});
