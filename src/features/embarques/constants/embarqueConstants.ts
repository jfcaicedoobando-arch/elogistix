export function getDocsForMode(modo: string): string[] {
  if (modo === 'Marítimo' || !modo) {
    return ['Bill of Lading (BL Master)', 'Bill of Lading (BL House)', 'Packing List', 'Factura Comercial', 'Certificado de Origen', 'Ficha Técnica', 'Otros'];
  }
  if (modo === 'Aéreo') {
    return ['Air Waybill (AWB)', 'Packing List', 'Factura Comercial'];
  }
  return ['Carta Porte', 'Factura', 'Lista de Empaque'];
}

// v13.303.22 — Nuevo orden del happy path: Arribo va antes de En Aduana
// (Borrador → Confirmado → En Tránsito → Arribo → En Aduana → Entregado →
// EIR → Cerrado). El estado `Llegada` queda deprecado (sale del workflow) y
// sólo persiste en el enum de BD para respetar históricos, con rescate a
// Arribo/En Aduana.
//
// v13.303.21 — Estado intermedio `Cotización` (Propuesta) eliminado del
// workflow: Borrador salta directo a Confirmado. El valor sigue en el enum
// como deprecado.
//
// v13.302.11 — `En Proceso` es un estado lateral del grafo. NO forma parte
// del happy path lineal, pero SÍ debe aparecer en filtros/conteos y tener
// una transición de salida via `getSiguienteEstado`. Ver
// `useEmbarqueEstadoActions.helpers.ts`.
// v13.380.0 — Nuevo estado `Por liquidar` entre EIR y Cerrado: cierre
// operativo terminado (el operador ya no tiene tareas) pero cierre financiero
// pendiente (falta cobrar al cliente y/o pagar al proveedor).
export const ESTADOS_EMBARQUE = [
  'Borrador', 'Confirmado', 'En Tránsito',
  'Arribo', 'En Aduana', 'Entregado', 'EIR', 'Por liquidar', 'Cerrado',
] as const;

export const ESTADOS_ACTIVOS = [
  'Confirmado', 'En Tránsito', 'En Proceso', 'Arribo', 'En Aduana', 'Entregado',
] as const;



export const MODOS_TRANSPORTE = ['Marítimo', 'Aéreo', 'Terrestre', 'Multimodal'] as const;

export const ICONO_EVENTO: Record<string, string> = {
  Zarpe: '🚢', Transbordo: '🔄', 'Arribo a Puerto': '⚓', Descarga: '📦',
  'Despacho Aduanal': '🛃', Liberación: '✅', 'En Ruta Terrestre': '🚛',
  Entrega: '🏁', Demora: '⚠️', Inspección: '🔍', Otro: '📝',
  'Cambio de ETA': '📅',
};

