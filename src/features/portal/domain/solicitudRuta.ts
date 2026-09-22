/**
 * Etapa 5 · helpers puros de la ruta en la solicitud de cotización del portal.
 *
 * Reglas:
 * - Sólo el modo Marítimo persiste identidad de puerto (IDs del catálogo).
 * - El texto libre siempre es válido: en ese caso el ID queda en `null`.
 * - Nunca se envían IDs de origen y destino iguales.
 */
import type { ModoTransporte } from "@/constants/wizardConstants";

export interface RutaSolicitud {
  modo: ModoTransporte;
  puertoOrigenId: string | null;
  puertoDestinoId: string | null;
}

export function esModoMaritimoSolicitud(modo: string): boolean {
  return modo === "Marítimo";
}

/** IDs que se envían a la base: sólo en Marítimo y nunca iguales. */
export function idsSolicitudPersistibles(
  ruta: RutaSolicitud,
): { puertoOrigenId: string | null; puertoDestinoId: string | null } {
  if (!esModoMaritimoSolicitud(ruta.modo)) {
    return { puertoOrigenId: null, puertoDestinoId: null };
  }
  const origen = ruta.puertoOrigenId ?? null;
  const destino = ruta.puertoDestinoId ?? null;
  if (origen && destino && origen === destino) {
    return { puertoOrigenId: origen, puertoDestinoId: null };
  }
  return { puertoOrigenId: origen, puertoDestinoId: destino };
}

/** Placeholder neutral (sin ejemplos sesgados a un país). */
export function placeholderRuta(
  modo: string,
  extremo: "origen" | "destino",
): string {
  return esModoMaritimoSolicitud(modo)
    ? `Busca o escribe puerto de ${extremo}`
    : `Ciudad, aeropuerto o terminal de ${extremo}`;
}
