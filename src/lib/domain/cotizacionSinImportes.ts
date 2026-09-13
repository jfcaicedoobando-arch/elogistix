/**
 * v13.823.364 — Copy del candado "cotización sin importes" según estado.
 *
 * El PDF no se genera cuando los conceptos de venta suman $0.00, pero el
 * mensaje anterior siempre pedía "sincroniza los conceptos": en `Aceptada` /
 * `En operación` el trigger `cotizaciones_guard_en_operacion` hace inmutables
 * `conceptos_venta`/`subtotal`, así que esa guía llevaba a un error seguro.
 */

const ESTADOS_INMUTABLES = new Set(["Aceptada", "En operación"]);
const ESTADOS_TERMINALES = new Set(["Rechazada", "Vencida", "Archivada"]);

export interface AvisoSinImportes {
  title: string;
  description: string;
}

/** Mensaje y CTA del candado de PDF/envío para una cotización en $0.00. */
export function mensajeCotizacionSinImportes(
  estado: string | null | undefined,
  tieneEmbarque = false,
): AvisoSinImportes {
  const title = "La cotización no tiene importes";
  if (tieneEmbarque || ESTADOS_INMUTABLES.has(estado ?? "")) {
    return {
      title,
      description:
        "Los conceptos de venta suman $0.00 y esta cotización ya no puede modificarse. Usa Re-cotizar para crear una nueva versión con importes o solicita una revisión administrativa.",
    };
  }
  if (ESTADOS_TERMINALES.has(estado ?? "")) {
    return {
      title,
      description:
        "Los conceptos de venta suman $0.00 y la cotización está cerrada. Crea una nueva versión con importes o solicita una revisión administrativa.",
    };
  }
  return {
    title,
    description:
      "Los conceptos de venta suman $0.00. Revisa la sección de costos y sincroniza los conceptos de venta antes de descargar el PDF.",
  };
}
