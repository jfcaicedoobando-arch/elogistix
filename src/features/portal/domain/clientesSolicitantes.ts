/**
 * Empresas que un usuario del portal puede usar como solicitante.
 *
 * Un usuario puede estar ligado a varias empresas: antes la pantalla elegía
 * `clienteIds[0]` y la solicitud se atribuía arbitrariamente a la primera sin
 * que el usuario lo supiera. Aquí se derivan las opciones autorizadas con
 * nombre legible para que la elección sea explícita.
 */
import type { PortalClientUser } from "@/features/portal/services/identity";

export interface ClienteSolicitante {
  id: string;
  nombre: string;
}

export function opcionesSolicitante(vinculos: PortalClientUser[]): ClienteSolicitante[] {
  const vistos = new Set<string>();
  const salida: ClienteSolicitante[] = [];
  for (const v of vinculos) {
    if (!v.cliente_id || vistos.has(v.cliente_id)) continue;
    vistos.add(v.cliente_id);
    salida.push({ id: v.cliente_id, nombre: v.cliente_nombre?.trim() || "Empresa sin nombre" });
  }
  return salida;
}

/** Preselección: con una sola empresa no se añade fricción; con varias, el
 *  usuario debe elegir expresamente para evitar atribución incorrecta. */
export function seleccionInicial(opciones: ClienteSolicitante[]): string {
  return opciones.length === 1 ? opciones[0].id : "";
}
