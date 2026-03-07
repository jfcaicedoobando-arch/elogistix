import type { Tables } from '@/integrations/supabase/types';

export type EmbarqueRow = Tables<'embarques'>;
export type ConceptoVentaRow = Tables<'conceptos_venta'>;
export type ConceptoCostoRow = Tables<'conceptos_costo'>;
export type DocumentoEmbarqueRow = Tables<'documentos_embarque'>;
export type NotaEmbarqueRow = Tables<'notas_embarque'>;

export function calcularEstadoEmbarque(
  modo: string,
  etd: string | null,
  eta: string | null,
  estadoActual: string
): string {
  const ESTADOS_MANUALES = ['Entregado', 'Cerrado', 'Cancelado'];
  if (ESTADOS_MANUALES.includes(estadoActual)) return estadoActual;
  if (modo !== 'Marítimo' || !etd || !eta) return estadoActual;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fechaETD = new Date(etd + 'T00:00:00');
  const fechaETA = new Date(eta + 'T00:00:00');

  if (hoy < fechaETD) return 'Confirmado';
  if (hoy >= fechaETD && hoy < fechaETA) return 'En Tránsito';
  if (hoy >= fechaETA) return 'En Aduana';

  return estadoActual;
}
