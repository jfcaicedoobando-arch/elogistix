/**
 * Tipos de dominio de vinculación con embarques (formulario CxP).
 * Extraídos de componentes `.tsx` (Bloque 1.3 auditoría 2026-07-23).
 */

export interface EmbarqueSeleccionado {
  embarqueId: string;
  expediente: string;
  concepto: string;
}

export interface SeleccionLinea {
  monto: number;
}
