/**
 * Tipos de dominio para tablas de costos internos P&L (Cotización).
 * Capa neutra: sin imports de components/hooks. Importable desde services/lib/hooks/components.
 *
 * El módulo `src/components/cotizacion/costosPLTypes.ts` re-exporta estos tipos
 * y conserva el helper `calcTotalsPL` (que sí depende de `lib/profitUtils`).
 */

export interface FilaCostoLocal {
  concepto: string;
  moneda: "USD" | "MXN";
  proveedor: string;
  cantidad: number;
  costo_unitario: number;
  precio_venta: number;
  unidad_medida: string;
  aplica_iva?: boolean;
  notas?: string;
}

export interface FilaCostoDetalle {
  concepto: string;
  moneda: "USD" | "MXN";
  proveedor: string;
  cantidad: number;
  costo_unitario: number;
  venta: number;
  aplica_iva?: boolean;
  notas?: string;
}
