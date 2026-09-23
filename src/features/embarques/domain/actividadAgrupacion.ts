/**
 * Agrupación visual de un mismo hecho de negocio en el feed de actividad.
 *
 * P2-3: un solo cambio de estado se registra en bitácora, evento y nota, así
 * que la misma hora aparecía tres veces ("Avanzó estado de embarque", "Otro",
 * "Cambio de estado"). Aquí no se borra nada: se elige un evento principal y
 * los demás quedan como `relacionados` (expandibles) sólo cuando comparten
 * minuto Y estado destino, para no colapsar cambios distintos del mismo minuto.
 */
import type { ActividadItem } from '@/features/embarques/domain/actividadFeed';

const ESTADOS = [
  'Borrador', 'Confirmado', 'En tránsito', 'En puerto', 'En aduana',
  'Liberado', 'Entregado', 'Cerrado', 'Cancelado',
];

function textoCompleto(item: ActividadItem): string {
  return `${item.accion} ${item.titulo} ${item.descripcion ?? ''}`;
}

/** ¿El registro habla de un cambio de estado del embarque? */
export function esCambioDeEstado(item: ActividadItem): boolean {
  const texto = textoCompleto(item).toLowerCase();
  return (
    /cambio de estado|cambi[oó] (de )?estado|avanz[oó] estado|estado cambiado/.test(texto) ||
    /(^|_)(cambiar|avanzar)_estado($|_)/.test(item.tipo) ||
    Boolean(estadoDestino(item))
  );
}

/** Estado destino declarado por el registro (título, descripción o detalles). */
export function estadoDestino(item: ActividadItem): string | null {
  const detalles = item.detalles ?? {};
  const directo = detalles['estado_nuevo'] ?? detalles['estadoNuevo'] ?? detalles['estado'];
  if (typeof directo === 'string' && directo.trim()) return directo.trim();
  const texto = textoCompleto(item);
  const match = /estado (?:cambiado )?a\s+"?([A-Za-zÁÉÍÓÚáéíóúñ ]+)"?/i.exec(texto);
  if (match) {
    const candidato = match[1].trim();
    const conocido = ESTADOS.find((e) => candidato.toLowerCase().startsWith(e.toLowerCase()));
    return conocido ?? candidato;
  }
  const mencionado = ESTADOS.find((e) => new RegExp(`\\b${e}\\b`, 'i').test(texto));
  return mencionado ?? null;
}

/** Ranking: gana el registro más informativo como evento principal. */
function utilidad(item: ActividadItem): number {
  return (
    (item.descripcion ? 100 : 0) +
    Math.min(item.titulo.length, 80) +
    (item.detalles ? 40 : 0) +
    (item.usuario ? 20 : 0)
  );
}

/**
 * Colapsa visualmente los registros del mismo cambio de estado.
 * Mantiene el orden de entrada y no descarta ningún registro.
 */
export function agruparHechosNegocio(items: ActividadItem[]): ActividadItem[] {
  const principalPorClave = new Map<string, ActividadItem>();
  const salida: ActividadItem[] = [];

  for (const item of items) {
    const destino = esCambioDeEstado(item) ? estadoDestino(item) : null;
    if (!destino) {
      salida.push(item);
      continue;
    }
    const clave = `estado|${item.fecha.slice(0, 16)}|${destino.toLowerCase()}`;
    const principal = principalPorClave.get(clave);
    if (!principal) {
      const nuevo: ActividadItem = { ...item, relacionados: [] };
      principalPorClave.set(clave, nuevo);
      salida.push(nuevo);
      continue;
    }
    if (utilidad(item) > utilidad(principal)) {
      // El nuevo registro es más informativo: pasa a principal y el anterior
      // se conserva como relacionado, sin perder el orden de la lista.
      const previos = principal.relacionados ?? [];
      const idx = salida.indexOf(principal);
      const nuevo: ActividadItem = {
        ...item,
        relacionados: [...previos, { ...principal, relacionados: undefined }],
      };
      if (idx >= 0) salida[idx] = nuevo;
      principalPorClave.set(clave, nuevo);
      continue;
    }
    principal.relacionados = [...(principal.relacionados ?? []), item];
  }

  return salida;
}
