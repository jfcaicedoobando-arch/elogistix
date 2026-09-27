import { describe, expect, it } from 'vitest';
import { deduplicarActividad, contarPorCategoria, type ActividadItem } from '../actividadFeed';
import { agruparHechosNegocio } from '../actividadAgrupacion';
import { claveActividadHecho } from '../actividadCorrelacion';

const embarque = '11111111-1111-4111-8111-111111111111';
const n1 = '22222222-2222-4222-8222-222222222222';
const n2 = '33333333-3333-4333-8333-333333333333';
const base: ActividadItem = { id: '', categoria: 'operacion', tipo: 'nota', fecha: '2026-09-27T02:55:00Z', usuario: 'coordinador@forwarder.example', accion: 'Nota', titulo: 'Reservar cita en Manzanillo y entrega en Apodaca', refTipo: 'embarque', refId: embarque };
function hecho(id: string, tipo: 'nota' | 'evento'): ActividadItem[] {
  return [
    { ...base, id: `${tipo === 'nota' ? 'nota-' : 'ev-'}${id}`, tipo, accion: tipo === 'nota' ? 'Nota' : 'Cambio de ETA' },
    { ...base, id: `bit-servicio-${id}`, tipo: 'bitacora', accion: 'Registro del servicio', detalles: { [tipo === 'nota' ? 'notaId' : 'eventoId']: id } },
    { ...base, id: `bit-ui-${id}`, tipo: 'bitacora', accion: 'Registro de UI', detalles: { [tipo === 'nota' ? 'notaId' : 'eventoId']: id } },
  ];
}

describe('hechos de notas y tracking con ID exacto', () => {
  it.each(['nota', 'evento'] as const)('representa %s una vez y conserva las dos bitácoras relacionadas', tipo => {
    const entrada = hecho(n1, tipo);
    const out = agruparHechosNegocio(deduplicarActividad(entrada));
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe(entrada[0].id);
    expect(out[0].relacionados?.map(r => r.id)).toEqual(entrada.slice(1).map(r => r.id));
    expect(contarPorCategoria(out)).toEqual({ operacion: 1 });
    expect(entrada.every(i => i.relacionados === undefined)).toBe(true);
  });

  it.each(['nota', 'evento'] as const)('conserva dos %s reales con texto y minuto idénticos', tipo => {
    const entrada = [...hecho(n1, tipo), ...hecho(n2, tipo)];
    const out = agruparHechosNegocio(deduplicarActividad(entrada));
    expect(out).toHaveLength(2);
    expect(out.flatMap(i => [i.id, ...(i.relacionados ?? []).map(r => r.id)])).toHaveLength(6);
    expect(contarPorCategoria(out)).toEqual({ operacion: 2 });
  });

  it('no asocia bitácoras históricas sin ID por coincidencia de texto/hora', () => {
    const rows = hecho(n1, 'nota').map((r, i) => i ? { ...r, detalles: undefined } : r);
    expect(agruparHechosNegocio(deduplicarActividad(rows))).toHaveLength(3);
  });

  it('no cruza embarques ni mezcla una referencia ambigua o mal formada', () => {
    const nota = hecho(n1, 'nota')[0];
    const bit = hecho(n1, 'nota')[1];
    expect(agruparHechosNegocio([nota, { ...bit, refId: n2 }])).toHaveLength(2);
    expect(claveActividadHecho({ ...bit, detalles: { notaId: n1, eventoId: n2 } })).toBeNull();
    expect(claveActividadHecho({ ...bit, detalles: { notaId: 'no-es-id' } })).toBeNull();
    expect(claveActividadHecho({ ...bit, refTipo: 'cotizacion' })).toBeNull();
  });

  it('suprime sólo la repetición del mismo registro y prioriza el hecho aun llegando después', () => {
    const entrada = hecho(n1, 'evento');
    const out = agruparHechosNegocio(deduplicarActividad([entrada[1], entrada[2], entrada[0], entrada[0]]));
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe(entrada[0].id);
    expect(out[0].relacionados).toHaveLength(2);
  });

  it('ignora correlación de nota en las transiciones legacy de estado', () => {
    const bit = { ...hecho(n1, 'nota')[1], dedupeKey: 'estado|202609270255' };
    expect(claveActividadHecho(bit)).toBeNull();
  });
});
