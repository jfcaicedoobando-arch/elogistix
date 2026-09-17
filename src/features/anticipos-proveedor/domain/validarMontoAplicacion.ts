/**
 * Validación pura del monto capturado al aplicar un anticipo a una factura.
 *
 * MNY P1.3: el monto está en la moneda del ANTICIPO; el saldo de la factura vive
 * en la moneda de la factura. El tope ya viene convertido con el DOF de la fecha
 * de aplicación (`calcularTopeAplicable`). Si no hay paridad, se rechaza en vez
 * de comparar dos monedas como si valieran lo mismo.
 */
import { formatCurrency } from "@/lib/formatters";

export interface ValidarMontoParams {
  montoNum: number;
  disponible: number;
  monedaAnticipo: string;
  monedaFactura: string;
  /** Máximo aplicable en moneda del anticipo; `null` = sin tipo de cambio. */
  tope: number | null;
  /** Fecha de aplicación (ISO) usada para el tipo de cambio. */
  fecha: string;
}

export interface ValidarMontoResultado {
  ok: boolean;
  error?: { title: string; description: string; method: string };
}

export function validarMontoAplicacion(
  { montoNum, disponible, monedaAnticipo, monedaFactura, tope, fecha }: ValidarMontoParams,
): ValidarMontoResultado {
  if (!(montoNum > 0)) {
    return {
      ok: false,
      error: {
        title: "Monto inválido",
        description: "El monto a aplicar debe ser mayor a cero.",
        method: "ANTICIPO_APLICAR_FACTURA_MONTO",
      },
    };
  }
  if (montoNum > disponible + 0.01) {
    return {
      ok: false,
      error: {
        title: "Excede el saldo a favor",
        description: `El anticipo sólo tiene ${formatCurrency(disponible, monedaAnticipo)} disponibles.`,
        method: "ANTICIPO_APLICAR_FACTURA_TOPE",
      },
    };
  }
  if (tope === null) {
    return {
      ok: false,
      error: {
        title: "Falta el tipo de cambio",
        description: `No hay tipo de cambio oficial del ${fecha} para convertir el saldo de la factura (${monedaFactura}) a ${monedaAnticipo}. Captúralo en Catálogos → Tipos de cambio.`,
        method: "ANTICIPO_APLICAR_FACTURA_SIN_TC",
      },
    };
  }
  if (montoNum > tope + 0.01) {
    return {
      ok: false,
      error: {
        title: "Excede el saldo de la factura",
        description: `Con el tipo de cambio del ${fecha} puedes aplicar hasta ${formatCurrency(tope, monedaAnticipo)}.`,
        method: "ANTICIPO_APLICAR_FACTURA_SALDO",
      },
    };
  }
  return { ok: true };
}
