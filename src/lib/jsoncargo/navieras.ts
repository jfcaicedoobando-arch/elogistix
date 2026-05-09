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
 * Mapea un string libre de naviera a uno de los shipping_line de JSONCargo.
 * Devuelve null si no hay match razonable.
 */
export function mapNavieraToJsonCargo(naviera: string | null | undefined): JsonCargoShippingLine | null {
  if (!naviera) return null;
  const n = naviera.toLowerCase().replace(/[^a-z0-9]/g, "");

  if (n.includes("maersk")) return "MAERSK";
  if (n.includes("hapag") || n.includes("lloyd")) return "HAPAG_LLOYD";
  if (n.includes("hyundai") || n === "hmm") return "HMM";
  if (n === "one" || n.includes("oceannetwork")) return "ONE";
  if (n.includes("evergreen")) return "EVERGREEN";
  if (n.includes("msc") || n.includes("mediterranean")) return "MSC";
  if (n.includes("cmacgm") || n.includes("cma")) return "CMA_CGM";
  if (n.includes("cosco") || n === "oocl" || n === "oolu" || n === "oocu" || n.includes("orientoverseas")) return "COSCO";
  if (n.includes("zim")) return "ZIM";
  if (n.includes("yangming") || n.includes("yang")) return "YANG_MING";
  if (n.includes("pil") || n.includes("pacificinternational")) return "PIL";

  return null;
}
