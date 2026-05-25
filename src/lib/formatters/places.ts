import { toTitleCase } from "./text";

/** Resuelve el origen de un embarque según modo (puerto > aeropuerto > ciudad) */
export const getOrigen = (e: { puerto_origen?: string | null; aeropuerto_origen?: string | null; ciudad_origen?: string | null }): string =>
  e.puerto_origen || e.aeropuerto_origen || e.ciudad_origen || "—";

/** Resuelve el destino de un embarque según modo (puerto > aeropuerto > ciudad) */
export const getDestino = (e: { puerto_destino?: string | null; aeropuerto_destino?: string | null; ciudad_destino?: string | null }): string =>
  e.puerto_destino || e.aeropuerto_destino || e.ciudad_destino || "—";

/**
 * Diccionario para corregir acentuación de lugares mexicanos comunes
 * que vienen sin acento desde catálogos legacy o entrada manual.
 */
const LUGARES_ACENTUADOS: Record<string, string> = {
  "mexico": "México",
  "ciudad de mexico": "Ciudad de México",
  "queretaro": "Querétaro",
  "yucatan": "Yucatán",
  "michoacan": "Michoacán",
  "nuevo leon": "Nuevo León",
  "san luis potosi": "San Luis Potosí",
  "atizapan": "Atizapán",
  "atizapan de zaragoza": "Atizapán de Zaragoza",
  "san andres cholula": "San Andrés Cholula",
  "merida": "Mérida",
  "leon": "León",
  "torreon": "Torreón",
  "culiacan": "Culiacán",
  "tlaxcala": "Tlaxcala",
  "estado de mexico": "Estado de México",
};

/**
 * Corrige la acentuación de lugares mexicanos comunes y aplica Title Case.
 * Si el texto incluye varias partes separadas por coma, se procesa cada una.
 */
export const correctSpanishPlace = (raw: string | null | undefined): string => {
  if (!raw) return "";
  return raw
    .split(",")
    .map((part) => {
      const titled = toTitleCase(part);
      const key = titled.trim().toLowerCase();
      return LUGARES_ACENTUADOS[key] ?? titled;
    })
    .join(", ");
};
