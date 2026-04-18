/**
 * Lógica pura de dominio de embarques.
 * Sin dependencias de React ni de la BD.
 */

export function calcularEstadoEmbarque(
  modo: string,
  tipo: string,
  etd: string | null,
  eta: string | null,
  estadoActual: string
): string {
  const ESTADOS_MANUALES = ['Arribo', 'En Aduana', 'Entregado', 'EIR', 'Cerrado'];
  if (ESTADOS_MANUALES.includes(estadoActual)) return estadoActual;

  // Solo calcula automático para importaciones marítimas
  if (modo !== 'Marítimo' || tipo !== 'Importación') return estadoActual;
  if (!etd || !eta) return estadoActual;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fechaETD = new Date(etd + 'T00:00:00');
  const fechaETA = new Date(eta + 'T00:00:00');

  if (hoy < fechaETD) return 'Confirmado';
  if (hoy >= fechaETD && hoy < fechaETA) return 'En Tránsito';
  if (hoy >= fechaETA) return 'Arribo';

  return estadoActual;
}
