import type { ActividadItem } from './actividadFeed';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function idValido(valor: unknown): string | null {
  return typeof valor === 'string' && UUID.test(valor) ? valor.toLowerCase() : null;
}

type Referencia = { tipo: 'nota' | 'evento'; id: string };

function referenciaBitacora(item: ActividadItem): Referencia | null {
  const nota = idValido(item.detalles?.notaId);
  const evento = idValido(item.detalles?.eventoId);
  // Referencias ambiguas no se fusionan ni se adivinan.
  if (nota && !evento) return { tipo: 'nota', id: nota };
  if (evento && !nota) return { tipo: 'evento', id: evento };
  return null;
}

function referenciaOrigen(item: ActividadItem): Referencia | null {
  if (item.tipo === 'bitacora') return referenciaBitacora(item);
  if (item.tipo === 'nota' && item.accion === 'Nota' && item.id.startsWith('nota-')) {
    const id = idValido(item.id.slice(5));
    return id ? { tipo: 'nota', id } : null;
  }
  if (item.tipo === 'evento' && item.id.startsWith('ev-')) {
    const id = idValido(item.id.slice(3));
    return id ? { tipo: 'evento', id } : null;
  }
  return null;
}

/** Identidad del hecho, no semejanza de texto/minuto. El RPC ya expone IDs. */
export function claveActividadHecho(item: ActividadItem): string | null {
  if (item.refTipo !== 'embarque' || !item.refId) return null;
  // No reinterpretar las transiciones que ya tienen su agrupación legacy.
  if (item.dedupeKey?.startsWith('estado|') || item.accion === 'Cambio de estado') return null;
  const ref = referenciaOrigen(item);
  return ref ? `hecho|${item.refId.toLowerCase()}|${ref.tipo}|${ref.id}` : null;
}
