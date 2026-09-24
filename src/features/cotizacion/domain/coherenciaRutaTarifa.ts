/**
 * P1-1 — Coherencia entre texto de ruta, IDs de puerto y tarifa vinculada.
 *
 * En marítimo con tarifa, la identidad exacta de los puertos es el ID. Si el
 * texto está vacío, falta un ID o el ID no es el de la tarifa, la cotización
 * quedaría contradictoria (la tarjeta dice Ningbo y el formulario Shanghai).
 * Función pura: el llamador decide cómo mostrar el mensaje.
 */
export const MSG_ORIGEN_INCOHERENTE =
  "El origen de la ruta no coincide con la tarifa vinculada. Vuelve a elegir la tarifa o el puerto de origen.";
export const MSG_DESTINO_INCOHERENTE =
  "El destino de la ruta no coincide con la tarifa vinculada. Vuelve a elegir la tarifa o el puerto de destino.";

export interface RutaConTarifa {
  modo?: string | null;
  tarifaId?: string | null;
  origen?: string | null;
  destino?: string | null;
  puertoOrigenId?: string | null;
  puertoDestinoId?: string | null;
}

export interface PuertosDeTarifa {
  puerto_origen_id?: string | null;
  puerto_destino_id?: string | null;
}

function ladoIncoherente(texto: string | null | undefined, id: string | null | undefined, idTarifa: string | null | undefined): boolean {
  if (!String(texto ?? "").trim() || !id) return true;
  return !!idTarifa && idTarifa !== id;
}

export function errorCoherenciaRutaTarifa(v: RutaConTarifa, tarifa?: PuertosDeTarifa | null): string | null {
  if (v.modo !== "Marítimo" || !v.tarifaId) return null;
  if (ladoIncoherente(v.origen, v.puertoOrigenId, tarifa?.puerto_origen_id)) return MSG_ORIGEN_INCOHERENTE;
  if (ladoIncoherente(v.destino, v.puertoDestinoId, tarifa?.puerto_destino_id)) return MSG_DESTINO_INCOHERENTE;
  return null;
}
