/**
 * Cotejo puro entre el monto que declaró operaciones al subir el documento y el
 * importe que trae la factura ya capturada (CFDI o captura manual).
 *
 * Nunca bloquea: sólo dice si coincide, si difiere o si no hay con qué comparar.
 * v13.507.0
 */

export interface CotejoMontoDeclarado {
  estado: "coincide" | "difiere" | "moneda_distinta" | "sin_datos";
  /** Diferencia (capturado − declarado) cuando ambas cifras son comparables. */
  diferencia: number;
  /** Diferencia relativa 0–1 respecto al monto declarado. */
  porcentaje: number;
}

const TOLERANCIA_RELATIVA = 0.01;
const TOLERANCIA_ABSOLUTA = 1;

export function cotejarMontoDeclarado(args: {
  montoDeclarado: number | null | undefined;
  monedaDeclarada: string | null | undefined;
  montoCapturado: number;
  monedaCapturada: string;
}): CotejoMontoDeclarado {
  const declarado = Number(args.montoDeclarado ?? 0);
  if (!declarado || declarado <= 0 || args.montoCapturado <= 0) {
    return { estado: "sin_datos", diferencia: 0, porcentaje: 0 };
  }

  const monedaDeclarada = (args.monedaDeclarada ?? "MXN").toUpperCase();
  if (monedaDeclarada !== args.monedaCapturada.toUpperCase()) {
    return { estado: "moneda_distinta", diferencia: 0, porcentaje: 0 };
  }

  const diferencia = args.montoCapturado - declarado;
  const absoluta = Math.abs(diferencia);
  const porcentaje = absoluta / declarado;
  const coincide = absoluta <= TOLERANCIA_ABSOLUTA || porcentaje <= TOLERANCIA_RELATIVA;

  return { estado: coincide ? "coincide" : "difiere", diferencia, porcentaje };
}
