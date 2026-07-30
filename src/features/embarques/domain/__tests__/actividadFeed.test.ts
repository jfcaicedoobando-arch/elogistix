import { describe, expect, it } from 'vitest';
import {
  agruparPorDia,
  contarPorCategoria,
  deduplicarActividad,
  filtrarPorCategoria,
  normalizarActividad,
  ordenarActividad,
  type ActividadRow,
} from '@/features/embarques/domain/actividadFeed';

function row(over: Partial<ActividadRow>): ActividadRow {
  return {
    id: 'x-1',
    categoria: 'operacion',
    tipo: 'nota',
    fecha: '2026-07-30T10:00:00Z',
    usuario: null,
    accion: 'Nota',
    titulo: 'Contenido',
    descripcion: null,
    monto: null,
    moneda: null,
    ref_tipo: null,
    ref_id: null,
    dedupe_key: null,
    detalles: null,
    ...over,
  };
}

describe('actividadFeed', () => {
  it('descarta filas sin fecha y normaliza categorías desconocidas', () => {
    const items = normalizarActividad([
      row({ id: 'a', fecha: '' }),
      row({ id: 'b', categoria: 'inventada' }),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].categoria).toBe('operacion');
  });

  it('conserva monto y detalles solo cuando son válidos', () => {
    const [item] = normalizarActividad([
      row({ monto: 1500, moneda: 'USD', detalles: { cambios: {} } }),
    ]);
    expect(item.monto).toBe(1500);
    expect(item.moneda).toBe('USD');
    expect(item.detalles).toEqual({ cambios: {} });

    const [sinDetalles] = normalizarActividad([row({ detalles: ['no-objeto'] })]);
    expect(sinDetalles.detalles).toBeUndefined();
  });

  it('prioriza la bitácora al deduplicar cambios de estado del mismo minuto', () => {
    const items = normalizarActividad([
      row({ id: 'bit-1', tipo: 'bitacora', accion: 'cambiar_estado', titulo: 'Cambio de estado' }),
      row({ id: 'nota-1', tipo: 'nota', accion: 'Cambio de estado', titulo: 'Estado cambiado a Arribo' }),
      row({ id: 'ev-1', tipo: 'evento', accion: 'Arribo', titulo: 'Estado cambiado a Arribo' }),
    ]);
    const out = deduplicarActividad(items);
    expect(out.map((i) => i.id)).toEqual(['bit-1']);
  });

  it('ordena de más reciente a más antiguo y agrupa por día', () => {
    const items = ordenarActividad(
      normalizarActividad([
        row({ id: '1', fecha: '2026-07-28T08:00:00Z' }),
        row({ id: '2', fecha: '2026-07-30T09:00:00Z' }),
        row({ id: '3', fecha: '2026-07-30T18:00:00Z' }),
      ]),
    );
    expect(items.map((i) => i.id)).toEqual(['3', '2', '1']);
    const grupos = agruparPorDia(items);
    expect(grupos.map((g) => g.dia)).toEqual(['2026-07-30', '2026-07-28']);
    expect(grupos[0].items).toHaveLength(2);
  });

  it('filtra por categoría y cuenta por categoría', () => {
    const items = normalizarActividad([
      row({ id: '1', categoria: 'finanzas', titulo: 'Factura' }),
      row({ id: '2', categoria: 'finanzas', titulo: 'Pago' }),
      row({ id: '3', categoria: 'riesgo', titulo: 'Garantía' }),
    ]);
    expect(filtrarPorCategoria(items, 'finanzas')).toHaveLength(2);
    expect(filtrarPorCategoria(items, 'todos')).toHaveLength(3);
    expect(contarPorCategoria(items)).toEqual({ finanzas: 2, riesgo: 1 });
  });
});
