/**
 * Tratamiento fiscal de IVA por renglón — fuente única de verdad.
 *
 * El catálogo de productos y servicios define el tratamiento del renglón y ese
 * tratamiento viaja SIN PÉRDIDA hasta el CFDI. Antes sólo se propagaba una
 * tasa (`tasa_iva_aplicada`) y un flag (`aplica_iva`), lo que colapsaba tres
 * situaciones fiscalmente distintas: tasa 0%, exento y **no objeto de impuesto**
 * (`ObjetoImp = 01` del SAT).
 *
 * Reglas:
 *  - `no_objeto` NUNCA se infiere de una tasa 0 ni se degrada a `exento`.
 *  - `no_objeto` no causa IVA trasladado: no lleva tasa ni factor "Exento".
 *  - Los renglones legacy (sin `tipo_iva`) siguen resolviéndose por
 *    `aplica_iva`/`tasa_iva_aplicada` exactamente como antes.
 */
import { TASA_IVA } from "@/lib/financial/financialUtils";

export const TIPOS_IVA_SAT = [
  "gravado_16",
  "gravado_8",
  "tasa_0",
  "exento",
  "no_objeto",
] as const;

export type TipoIvaSat = (typeof TIPOS_IVA_SAT)[number];

/** Tasa de IVA de la región fronteriza norte/sur. */
export const TASA_IVA_FRONTERA_MX = 0.08;

/** Etiquetas largas (formularios de alta/edición). */
export const TIPO_IVA_LABEL_SAT: Record<TipoIvaSat, string> = {
  gravado_16: "IVA 16%",
  gravado_8: "IVA 8% (frontera)",
  tasa_0: "IVA 0%",
  exento: "Exento",
  no_objeto: "No objeto de impuesto (SAT 01)",
};

/** Etiquetas cortas (listas, badges, resúmenes y PDF). */
export const TIPO_IVA_LABEL_CORTO: Record<TipoIvaSat, string> = {
  gravado_16: "16%",
  gravado_8: "8%",
  tasa_0: "0%",
  exento: "Exento",
  no_objeto: "No objeto",
};

/**
 * P2-IVA — Ayuda breve por tratamiento fiscal. Existe porque "tasa 0%",
 * "exento" y "no objeto" se confunden entre sí. Ninguna descripción sugiere
 * que una categoría se deduzca de otra: cada una se elige explícitamente.
 */
export const TIPO_IVA_AYUDA: Record<TipoIvaSat, string> = {
  gravado_16: "Acto gravado a la tasa general del país.",
  gravado_8:
    "Estímulo fiscal de la región fronteriza norte/sur: exige aviso ante el SAT y requisitos vigentes.",
  tasa_0:
    "Acto SÍ gravado, pero con tasa 0% (p. ej. exportación). Da derecho a acreditar el IVA de los gastos.",
  exento:
    "Acto sin IVA por disposición de ley. NO da derecho a acreditar el IVA de los gastos.",
  no_objeto:
    "Actividad fuera del objeto de la Ley del IVA (ObjetoImp 01 del CFDI). No es exento ni tasa 0%.",
};

/** Nota general del selector: cada categoría se captura, no se infiere. */
export const TIPO_IVA_AYUDA_GENERAL =
  "Tasa 0%, exento y no objeto son tratamientos distintos ante el SAT y ninguno se deduce de otro: elige el que corresponda al producto o servicio.";

/** Opciones en el orden que espera el contador (de mayor a menor gravamen). */
export const TIPO_IVA_OPCIONES: ReadonlyArray<{ value: TipoIvaSat; label: string }> =
  TIPOS_IVA_SAT.map((value) => ({ value, label: TIPO_IVA_LABEL_SAT[value] }));



export function esTipoIvaSat(value: unknown): value is TipoIvaSat {
  return typeof value === "string" && (TIPOS_IVA_SAT as readonly string[]).includes(value);
}

/** `true` sólo para el tratamiento SAT `ObjetoImp = 01`. */
export function esNoObjetoIva(tipo: string | null | undefined): boolean {
  return tipo === "no_objeto";
}

/**
 * Tasa de IVA trasladado del renglón. `null` = el renglón no causa IVA
 * trasladado (exento y no objeto). Nunca lanza: un tipo desconocido cae al
 * comportamiento histórico (gravado a la tasa global).
 */
export function tasaDeTipoIva(
  tipo: string | null | undefined,
  tasaGlobal: number = TASA_IVA,
): number | null {
  if (tipo === "gravado_8") return TASA_IVA_FRONTERA_MX;
  if (tipo === "tasa_0") return 0;
  if (tipo === "exento" || tipo === "no_objeto") return null;
  return tasaGlobal;
}

/** Tasa a usar en cálculos agregados: exento y no objeto aportan 0 de IVA. */
export function tasaParaTotales(
  tipo: string | null | undefined,
  tasaGlobal: number = TASA_IVA,
): number {
  return tasaDeTipoIva(tipo, tasaGlobal) ?? 0;
}

/** Valor `tasa_iva_default` a guardar en el catálogo (NULL si no causa IVA). */
export function tasaDefaultCatalogo(tipo: TipoIvaSat): number | null {
  return tasaDeTipoIva(tipo);
}

/** ObjetoImp del CFDI 4.0: "01" = no objeto, "02" = sí objeto de impuesto. */
export function objetoImpDeTipoIva(tipo: string | null | undefined): "01" | "02" {
  return esNoObjetoIva(tipo) ? "01" : "02";
}

/**
 * Resuelve el tipo de un renglón legacy que sólo guardó tasa y flag.
 * Jamás devuelve `no_objeto`: ese tratamiento sólo existe si se guardó
 * explícitamente.
 */
export function tipoIvaDesdeLegacy(
  aplicaIva: boolean | null | undefined,
  tasa: number | null | undefined,
): TipoIvaSat {
  if (aplicaIva === false) return "exento";
  if (tasa === 0) return "tasa_0";
  if (tasa != null && Math.abs(tasa - TASA_IVA_FRONTERA_MX) < 1e-9) return "gravado_8";
  return "gravado_16";
}

/**
 * P1-IVA — clasificación que corresponde a una tasa elegida en el selector.
 * Sólo se usa cuando el usuario mueve la tasa de una línea gravable: nunca
 * produce `exento` ni `no_objeto` (esos tratamientos se eligen explícitamente).
 */
export function tipoIvaDesdeTasaSeleccionada(tasa: number): TipoIvaSat {
  if (tasa === 0) return "tasa_0";
  if (Math.abs(tasa - TASA_IVA_FRONTERA_MX) < 1e-9) return "gravado_8";
  return "gravado_16";
}

/**
 * Tipo efectivo de un renglón: respeta el `tipo_iva` explícito y sólo cae al
 * derivado legacy cuando no hay tipo guardado.
 */
export function tipoIvaEfectivo(fila: {
  tipo_iva?: string | null;
  aplica_iva?: boolean | null;
  tasa_iva_aplicada?: number | null;
}): TipoIvaSat {
  if (esTipoIvaSat(fila.tipo_iva)) return fila.tipo_iva;
  return tipoIvaDesdeLegacy(fila.aplica_iva, fila.tasa_iva_aplicada);
}
