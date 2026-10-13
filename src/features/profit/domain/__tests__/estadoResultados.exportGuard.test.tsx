import { describe, expect, it } from 'vitest';
import { buildEstadoResultados } from '../estadoResultados';
import { ReporteEERRDocument } from '@/pdf/documents/ReporteEERRDocument';
import { buildEstadoResultadosCsvRows } from '../../components/EstadoResultadosTable.helpers';

describe('EERR exact export guards', () => {
  it('rejects a direct PDF renderer call when valuation is incomplete', () => {
    const data = buildEstadoResultados([{id:'a',modo:'Otros',tipo_cambio_usd:null,tipo_cambio_eur:null}], [],
      [{embarque_id:'a',concepto:'Costo',monto:100,moneda:'USD'}]);
    expect(() => ReporteEERRDocument({periodo:'2026-10',fuente:'embarques',data})).toThrow(/Valuación incompleta/);
  });
  it('exports a real loss but no numerical margin when income is zero', () => {
    const data = buildEstadoResultados([{id:'a',modo:'Otros',tipo_cambio_usd:null,tipo_cambio_eur:null}], [],
      [{embarque_id:'a',concepto:'Costo',monto:100,moneda:'MXN'}]);
    const rows = buildEstadoResultadosCsvRows(data);
    expect(rows.find(r=>r.concepto === 'UTILIDAD BRUTA')?.total).toBe('-100.00');
    expect(rows.find(r=>r.concepto === 'MARGEN %')?.total).toBe('No calculable');
  });
});
