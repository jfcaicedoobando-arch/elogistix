export function getDocsForMode(modo: string): string[] {
  if (modo === 'Marítimo' || !modo) {
    return ['Bill of Lading (BL Master)', 'Bill of Lading (BL House)', 'Packing List', 'Factura Comercial', 'Certificado de Origen', 'Ficha Técnica', 'Otros'];
  }
  if (modo === 'Aéreo') {
    return ['Air Waybill (AWB)', 'Packing List', 'Factura Comercial'];
  }
  return ['Carta Porte', 'Factura', 'Lista de Empaque'];
}

// v13.302.10 — Sincronizado con el grafo de la máquina de estados de BD
// (mig. `20260718214722`). El orden debe coincidir con el happy path para que
// `getSiguienteEstado` (UI "Avanzar estado") nunca proponga una transición
// inválida. Ver `estados-embarque-sync.test.ts`.
//
// v13.302.11 — `En Proceso` es un estado lateral del grafo (arista
// `En Tránsito → En Proceso → {En Aduana, Llegada, Arribo}`). NO forma parte
// del happy path lineal, pero SÍ debe aparecer en filtros/conteos y tener
// una transición de salida via `getSiguienteEstado` para que el operador no
// quede atorado. Ver `useEmbarqueEstadoActions.helpers.ts`.
export const ESTADOS_EMBARQUE = [
  'Borrador', 'Cotización', 'Confirmado', 'En Tránsito',
  'En Aduana', 'Llegada', 'Arribo', 'Entregado', 'EIR', 'Cerrado',
] as const;

export const ESTADOS_ACTIVOS = [
  'Cotización', 'Confirmado', 'En Tránsito', 'En Proceso', 'En Aduana', 'Llegada', 'Arribo', 'Entregado',
] as const;



export const MODOS_TRANSPORTE = ['Marítimo', 'Aéreo', 'Terrestre', 'Multimodal'] as const;

export const ICONO_EVENTO: Record<string, string> = {
  Zarpe: '🚢', Transbordo: '🔄', 'Arribo a Puerto': '⚓', Descarga: '📦',
  'Despacho Aduanal': '🛃', Liberación: '✅', 'En Ruta Terrestre': '🚛',
  Entrega: '🏁', Demora: '⚠️', Inspección: '🔍', Otro: '📝',
  'Cambio de ETA': '📅',
};

