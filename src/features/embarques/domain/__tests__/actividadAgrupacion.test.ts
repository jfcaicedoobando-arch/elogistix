import { describe, expect, it } from 'vitest';
import { agruparHechosNegocio } from '@/features/embarques/domain/actividadAgrupacion';
import type { ActividadItem } from '@/features/embarques/domain/actividadFeed';

function item(over: Partial<ActividadItem>): ActividadItem {
  return {
    id: 'i-1',
    categoria: 'operacion',
    tipo: 'evento',
    fecha: '2026-09-22T08:10:00Z',
    usuario: 'ops@x.com',
    accion: 'Otro',
    titulo: 'Estado cambiado a Confirmado',
    ...over,
  };
}

describe('agruparHechosNegocio (P2-3)', () => {
  it('colapsa el mismo cambio de estado en un evento principal con relacionados', () => {
    const out = agruparHechosNegocio([
      item({ id: 'bit-1', accion: 'Avanzó estado de embarque', titulo: 'Estado cambiado a Confirmado', descripcion: 'De Borrador a Confirmado' }),
      item({ id: 'ev-1', accion: 'Otro', titulo: 'Confirmado' }),
      item({ id: 'nota-1', accion: 'Cambio de estado', titulo: 'Estado cambiado a Confirmado' }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('bit-1');
    expect(out[0].relacionados?.map((r) => r.id)).toEqual(['ev-1', 'nota-1']);
  });

  it('no colapsa cambios distintos del mismo minuto ni otros hechos', () => {
    const out = agruparHechosNegocio([
      item({ id: 'a', titulo: 'Estado cambiado a Confirmado' }),
      item({ id: 'b', titulo: 'Estado cambiado a En tránsito' }),
      item({ id: 'c', accion: 'Documento cargado', titulo: 'BL subido' }),
    ]);
    expect(out.map((i) => i.id)).toEqual(['a', 'b', 'c']);
    expect(out.every((i) => (i.relacionados?.length ?? 0) === 0)).toBe(true);
  });

  it('no pierde registros: los relacionados siguen disponibles', () => {
    const entrada = [
      item({ id: 'x', accion: 'Otro', titulo: 'Confirmado' }),
      item({ id: 'y', accion: 'Cambio de estado', titulo: 'Estado cambiado a Confirmado', descripcion: 'Detalle largo del cambio' }),
    ];
    const out = agruparHechosNegocio(entrada);
    const total = out.length + out.reduce((a, i) => a + (i.relacionados?.length ?? 0), 0);
    expect(total).toBe(entrada.length);
    expect(out[0].id).toBe('y');
    expect(out[0].relacionados?.[0].id).toBe('x');
  });

  it('un cambio de estado en otro minuto no se agrupa', () => {
    const out = agruparHechosNegocio([
      item({ id: 'm1', fecha: '2026-09-22T08:10:00Z' }),
      item({ id: 'm2', fecha: '2026-09-22T08:11:00Z' }),
    ]);
    expect(out).toHaveLength(2);
  });
});
