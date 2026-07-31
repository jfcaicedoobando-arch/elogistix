/**
 * P2-6.7 — Preferencias de la última solicitud de cotización del portal.
 *
 * El modal preseleccionaba siempre "Importación" / "Marítimo" / "FCL", lo que
 * obligaba al cliente exportador a corregir los tres campos en cada solicitud.
 * Se recuerda su última elección en el navegador (no es dato de negocio, así
 * que no viaja a la base).
 */
import { safeLocalStorage } from "@/lib/browserStorage";

const KEY = "lc-portal-solicitud-prefs";

export interface SolicitudPreferencias {
  modo: string;
  tipo: string;
  tipoEmbarque: string;
}

export const SOLICITUD_PREFS_DEFAULT: SolicitudPreferencias = {
  modo: "Marítimo",
  tipo: "Importación",
  tipoEmbarque: "FCL",
};

function esTexto(valor: unknown): valor is string {
  return typeof valor === "string" && valor.trim().length > 0;
}

/** Lee las preferencias guardadas; cae a los valores por defecto si no hay. */
export function leerSolicitudPreferencias(
  raw: string | null = safeLocalStorage.getItem(KEY),
): SolicitudPreferencias {
  if (!raw) return SOLICITUD_PREFS_DEFAULT;
  try {
    const parsed = JSON.parse(raw) as Partial<SolicitudPreferencias>;
    return {
      modo: esTexto(parsed.modo) ? parsed.modo : SOLICITUD_PREFS_DEFAULT.modo,
      tipo: esTexto(parsed.tipo) ? parsed.tipo : SOLICITUD_PREFS_DEFAULT.tipo,
      tipoEmbarque: esTexto(parsed.tipoEmbarque)
        ? parsed.tipoEmbarque
        : SOLICITUD_PREFS_DEFAULT.tipoEmbarque,
    };
  } catch {
    return SOLICITUD_PREFS_DEFAULT;
  }
}

/** Guarda la elección del cliente para la siguiente solicitud. */
export function guardarSolicitudPreferencias(prefs: SolicitudPreferencias): void {
  safeLocalStorage.setItem(KEY, JSON.stringify(prefs));
}
