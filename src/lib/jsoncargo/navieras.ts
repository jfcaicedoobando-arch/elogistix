/**
 * Mapeo de naviera (texto libre del embarque) → shipping_line param de JSONCargo.
 * Navieras compatibles JSONCargo (oct 2024): MAERSK, HAPAG_LLOYD, HMM, ONE,
 * EVERGREEN, MSC, CMA_CGM, COSCO, ZIM, YANG_MING, PIL.
 */

export const JSONCARGO_SHIPPING_LINES = [
  "MAERSK",
  "HAPAG_LLOYD",
  "HMM",
  "ONE",
  "EVERGREEN",
  "MSC",
  "CMA_CGM",
  "COSCO",
  "ZIM",
  "YANG_MING",
  "PIL",
] as const;

export type JsonCargoShippingLine = (typeof JSONCARGO_SHIPPING_LINES)[number];

const NAVIERA_LABELS: Record<JsonCargoShippingLine, string> = {
  MAERSK: "Maersk",
  HAPAG_LLOYD: "Hapag-Lloyd",
  HMM: "HMM",
  ONE: "Ocean Network Express (ONE)",
  EVERGREEN: "Evergreen",
  MSC: "MSC",
  CMA_CGM: "CMA CGM",
  COSCO: "COSCO",
  ZIM: "ZIM",
  YANG_MING: "Yang Ming",
  PIL: "PIL",
};

export function listNavierasSoportadas(): { value: JsonCargoShippingLine; label: string }[] {
  return JSONCARGO_SHIPPING_LINES.map((v) => ({ value: v, label: NAVIERA_LABELS[v] }));
}

/**
 * Tabla de reglas: cada entrada es `[línea, predicados...]`. Predicados pueden
 * ser strings (substring) o funciones para comparaciones exactas. Se evalúan
 * en orden — la primera coincidencia gana.
 */
type MatchRule = string | ((n: string) => boolean);

const NAVIERA_RULES: ReadonlyArray<readonly [JsonCargoShippingLine, ReadonlyArray<MatchRule>]> = [
  ["MAERSK", ["maersk"]],
  ["HAPAG_LLOYD", ["hapag", "lloyd"]],
  ["HMM", ["hyundai", (n) => n === "hmm"]],
  ["ONE", [(n) => n === "one", "oceannetwork"]],
  ["EVERGREEN", ["evergreen", (n) => n === "eglv"]],
  ["MSC", ["msc", "mediterranean"]],
  ["CMA_CGM", ["cmacgm", "cma"]],
  ["COSCO", ["cosco", (n) => n === "oocl", (n) => n === "oolu", (n) => n === "oocu", "orientoverseas"]],
  ["ZIM", ["zim"]],
  ["YANG_MING", ["yangming", "yang"]],
  ["PIL", ["pil", "pacificinternational"]],
];

function matches(normalized: string, rule: MatchRule): boolean {
  return typeof rule === "string" ? normalized.includes(rule) : rule(normalized);
}

/**
 * Mapea un string libre de naviera a uno de los shipping_line de JSONCargo.
 * Devuelve null si no hay match razonable.
 */
export function mapNavieraToJsonCargo(naviera: string | null | undefined): JsonCargoShippingLine | null {
  if (!naviera) return null;
  const n = naviera.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const [line, rules] of NAVIERA_RULES) {
    if (rules.some((r) => matches(n, r))) return line;
  }
  return null;
}
