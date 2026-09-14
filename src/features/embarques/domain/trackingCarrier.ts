/**
 * P1 modo (v13.823.366) — Resuelve qué transportista y referencia de tracking
 * aplica según el modo del embarque.
 *
 * Antes `TrackingNavieraActions` trataba cualquier modo distinto de Marítimo
 * como Aéreo: un embarque Terrestre pedía "aerolínea y MAWB". Ahora:
 * - Marítimo y Multimodal → naviera + BL Master.
 * - Aéreo → aerolínea + MAWB.
 * - Terrestre (y cualquier otro modo) → sin tracking de transportista; el
 *   seguimiento se registra manualmente con "Registrar evento".
 */
export interface TrackingCarrierInput {
  modo: string;
  naviera: string | null;
  aerolinea: string | null;
  blMaster: string | null;
  mawb: string | null;
}

export interface TrackingCarrier {
  esMaritimo: boolean;
  carrier: string | null;
  referencia: string | null;
  refLabel: "BL Master" | "MAWB";
  /** Texto del aviso cuando no hay transportista ni referencia capturados. */
  capturaFaltante: string;
}

/** Modos con tracking web por transportista marítimo. */
const MODOS_MARITIMOS = new Set(["Marítimo", "Multimodal"]);

export function resolverTrackingCarrier(input: TrackingCarrierInput): TrackingCarrier | null {
  if (MODOS_MARITIMOS.has(input.modo)) {
    return {
      esMaritimo: true,
      carrier: input.naviera,
      referencia: input.blMaster,
      refLabel: "BL Master",
      capturaFaltante: "naviera y el BL Master",
    };
  }
  if (input.modo === "Aéreo") {
    return {
      esMaritimo: false,
      carrier: input.aerolinea,
      referencia: input.mawb,
      refLabel: "MAWB",
      capturaFaltante: "aerolínea y el MAWB",
    };
  }
  // Terrestre y otros modos: sin consulta web de transportista.
  return null;
}
