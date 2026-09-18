/**
 * P1-IVA (lado servidor) — espejo Deno de `src/lib/financial/coherenciaIva.ts`.
 *
 * Mismas reglas: `no_objeto`/`exento`/`tasa_0` no se infieren ni se traducen
 * entre sí; una combinación contradictoria o un renglón legado ambiguo NO se
 * "arregla" con un 16% por omisión: se bloquea el timbrado con un mensaje
 * accionable. Se duplica a propósito porque las edge functions no pueden
 * importar `src/`.
 */
export type TipoIvaSat = "gravado_16" | "gravado_8" | "tasa_0" | "exento" | "no_objeto";

const TIPOS: readonly string[] = ["gravado_16", "gravado_8", "tasa_0", "exento", "no_objeto"];
const TASA_GENERAL = 0.16;
const TASA_FRONTERA = 0.08;
const EPS = 1e-9;

export interface FilaIvaClasificable {
  tipo_iva?: string | null;
  tasa_iva_aplicada?: number | string | null;
  aplica_iva?: boolean | null;
}

export interface ResultadoCoherenciaIva {
  estado: "ok" | "incoherente" | "ambiguo";
  tipo: TipoIvaSat;
  tasa: number;
  motivo?: string;
}

function tasaCanonica(tipo: TipoIvaSat, tasaGlobal: number): number {
  if (tipo === "gravado_8") return TASA_FRONTERA;
  if (tipo === "gravado_16") return tasaGlobal;
  return 0;
}

export function clasificarCoherenciaIva(
  fila: FilaIvaClasificable,
  tasaGravadoDefault: number = TASA_GENERAL,
): ResultadoCoherenciaIva {
  const crudo = fila.tasa_iva_aplicada;
  const tasaNum = crudo != null && Number.isFinite(Number(crudo)) ? Number(crudo) : null;
  const flag = fila.aplica_iva;

  if (typeof fila.tipo_iva === "string" && TIPOS.includes(fila.tipo_iva)) {
    const tipo = fila.tipo_iva as TipoIvaSat;
    const canonica = tasaCanonica(tipo, tasaGravadoDefault);
    const noCausa = tipo === "no_objeto" || tipo === "exento" || tipo === "tasa_0";
    const etiqueta = tipo === "tasa_0" ? "tasa 0%" : tipo === "exento" ? "exento" : "no objeto de impuesto (SAT 01)";

    if (noCausa) {
      if (tasaNum != null && tasaNum > 0) {
        return {
          estado: "incoherente",
          tipo,
          tasa: 0,
          motivo: `está clasificado como ${etiqueta} pero tiene una tasa de IVA de ${(tasaNum * 100).toFixed(2)}%`,
        };
      }
      if (flag === true && tipo !== "tasa_0") {
        return { estado: "incoherente", tipo, tasa: 0, motivo: `está clasificado como ${etiqueta} pero tiene el IVA activado` };
      }
      return { estado: "ok", tipo, tasa: 0 };
    }

    if (flag === false) {
      return {
        estado: "incoherente",
        tipo,
        tasa: canonica,
        motivo: `está clasificado como gravado (${(canonica * 100).toFixed(0)}%) pero el IVA quedó desactivado; falta definir si es tasa 0%, exento o no objeto`,
      };
    }
    if (tasaNum != null && Math.abs(tasaNum - canonica) >= EPS) {
      return {
        estado: "incoherente",
        tipo,
        tasa: canonica,
        motivo: `está clasificado como gravado ${(canonica * 100).toFixed(0)}% pero tiene una tasa de ${(tasaNum * 100).toFixed(2)}%`,
      };
    }
    return { estado: "ok", tipo, tasa: canonica };
  }

  // Legado sin `tipo_iva`.
  if (flag === false && tasaNum != null && tasaNum > 0) {
    return {
      estado: "ambiguo",
      tipo: "exento",
      tasa: 0,
      motivo:
        "no tiene tratamiento fiscal registrado: el IVA está desactivado pero conserva una tasa distinta de cero, así que no se puede determinar si es tasa 0%, exento o no objeto",
    };
  }
  if (flag === false) return { estado: "ok", tipo: "exento", tasa: 0 };
  if (tasaNum != null && Math.abs(tasaNum) < EPS) return { estado: "ok", tipo: "tasa_0", tasa: 0 };
  if (tasaNum != null && Math.abs(tasaNum - TASA_FRONTERA) < EPS) return { estado: "ok", tipo: "gravado_8", tasa: TASA_FRONTERA };
  return { estado: "ok", tipo: "gravado_16", tasa: tasaNum ?? tasaGravadoDefault };
}

export function mensajeCoherenciaIva(descripcion: string, resultado: ResultadoCoherenciaIva): string {
  return `El concepto "${descripcion}" ${resultado.motivo ?? "tiene un tratamiento de IVA inconsistente"}. Corrige el tratamiento fiscal del renglón (16%, 8%, 0%, exento o no objeto) antes de timbrar.`;
}
