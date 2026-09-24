/**
 * Traducción a lenguaje humano del feed de actividad del embarque.
 *
 * P2-2: el RPC entrega claves técnicas (`factura.borrador_generado`,
 * `cambio_financiero_facturas`, `serie_id`, `embarque_ids`…). La lectura
 * principal debe ser una frase en español; el JSON/UUID queda disponible sólo
 * bajo un disclosure para no perder auditoría.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Títulos humanos de los eventos habituales (accion/tipo del backend). */
const EVENTO_LABEL: Record<string, string> = {
  'factura.borrador_generado': 'Se generó un borrador de factura',
  'factura.emitida': 'Factura emitida',
  'factura.cancelada': 'Factura cancelada',
  cambio_financiero_facturas: 'Cambio financiero en facturas',
  cambio_financiero: 'Cambio financiero',
  tarifa_decision_aplicada: 'Se aplicó la decisión de tarifa',
  cambiar_estado: 'Cambio de estado del embarque',
  avanzar_estado: 'Cambio de estado del embarque',
  recalcular_demoras: 'Recálculo de demoras automáticas',
  eliminar_demoras_auto: 'Se eliminaron las demoras automáticas',
  actualizar_embarque: 'Actualización del embarque',
  crear_embarque: 'Alta del embarque',
  proforma_generada: 'Proforma generada',
  proforma_enviada: 'Proforma enviada al cliente',
  'proforma.aceptada_sin_autorizacion': 'Proforma aceptada sin autorización previa',
  'proforma.aceptada': 'Proforma aceptada por el cliente',
  editar_cotizacion: 'Edición de la cotización',
  crear_cotizacion: 'Alta de la cotización',
  pago_registrado: 'Pago registrado',
  documento_subido: 'Documento cargado',
  editar: 'Edición del embarque',
  'Avanzó estado de embarque': 'Cambio de estado del embarque',

};

/** Etiquetas humanas de las claves de `detalles`. */
const DETALLE_LABEL: Record<string, string> = {
  serie_id: 'Serie de facturación',
  serie: 'Serie',
  folio: 'Folio',
  embarque_ids: 'Embarques incluidos',
  estado_anterior: 'Estado anterior',
  estado_nuevo: 'Estado nuevo',
  nuevoEstado: 'Estado nuevo',
  tipoEvento: 'Tipo de evento',
  descripcionEvento: 'Descripción',
  moneda: 'Moneda',
  total: 'Total',
  subtotal: 'Subtotal',
  motivo: 'Motivo',
  diasExcedidos: 'Días excedidos',
  dias_excedidos: 'Días excedidos',
  sinEventos: 'Sin eventos en timeline',
  decision: 'Decisión',
  tipo_cambio: 'Tipo de cambio',
};

/** `avanzar_estado` → `Avanzar estado`. Fallback legible de claves desconocidas. */
export function humanizarClave(clave: string): string {
  const texto = clave.replace(/[._]+/g, ' ').trim();
  if (!texto) return clave;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Frase principal del evento; nunca una clave snake_case cruda. */
export function etiquetaEvento(valor: string | undefined | null): string {
  const clave = (valor ?? '').trim();
  if (!clave) return 'Actividad registrada';
  return EVENTO_LABEL[clave] ?? humanizarClave(clave);
}

/** Un UUID o un JSON crudo no se muestran en la lectura principal. */
export function esValorTecnico(clave: string, valor: unknown): boolean {
  if (/(^|_)(id|ids|uuid|key|hash|payload|raw)$/i.test(clave) && !DETALLE_LABEL[clave]) return true;
  if (typeof valor === 'string' && UUID_RE.test(valor)) return true;
  if (Array.isArray(valor)) return valor.some((v) => typeof v === 'string' && UUID_RE.test(v));
  return typeof valor === 'object' && valor !== null;
}

export function etiquetaDetalle(clave: string): string {
  return DETALLE_LABEL[clave] ?? humanizarClave(clave);
}

export function formatearValorDetalle(valor: unknown): string {
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  if (Array.isArray(valor)) return `${valor.length} elemento(s)`;
  if (valor === null || valor === undefined) return '—';
  if (typeof valor === 'object') return 'ver detalle técnico';
  return String(valor);
}

/**
 * Pares legibles de `detalles` para la lectura principal: sin UUID ni JSON.
 * El objeto completo sigue disponible en el disclosure técnico.
 */
export function detallesLegibles(detalles: Record<string, unknown>): Array<[string, string]> {
  return Object.entries(detalles)
    .filter(([k, v]) => v !== null && v !== undefined && v !== '' && !esValorTecnico(k, v))
    .map(([k, v]) => [etiquetaDetalle(k), formatearValorDetalle(v)] as [string, string]);
}
