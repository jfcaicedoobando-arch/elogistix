import { fetchAvailableUsers, fetchNombresUsuarios } from "@/features/admin/services/usuario/availableUsers";
import { UNRESOLVED_EMAIL } from "@/features/admin/services/usuario/constants";

export type EstadoIdentidadVendedora = "resuelta" | "sin_nombre" | "no_encontrada" | "error_consulta";
export interface IdentidadVendedora {
  nombre: string;
  email: string | null;
  estadoIdentidad: EstadoIdentidadVendedora;
  identidadResuelta: boolean;
}

export const puedeConsultarCorreoVendedoras = (role: string | null) =>
  role !== null && ["admin", "admin_org", "super_admin"].includes(role);

function identidadDesdeUsuario(user: { full_name?: string | null; email?: string } | undefined, conCorreos: boolean): IdentidadVendedora {
  const nombre = user?.full_name?.trim() || null;
  const email = conCorreos ? user?.email?.trim() || null : null;
  return {
    nombre: nombre ?? email ?? (user ? "Nombre no capturado" : UNRESOLVED_EMAIL),
    email,
    estadoIdentidad: nombre || email ? "resuelta" : user ? "sin_nombre" : "no_encontrada",
    identidadResuelta: Boolean(nombre || email),
  };
}

function marcarEtiquetasAmbiguas(map: Map<string, IdentidadVendedora>) {
  const labels = [...map.values()].map((v) => v.nombre.toLocaleLowerCase());
  for (const value of map.values()) {
    const repetido = labels.filter((label) => label === value.nombre.toLocaleLowerCase()).length > 1;
    if (repetido && !value.email) value.identidadResuelta = false;
  }
}

/** Usa únicamente los catálogos ya autorizados; list-nombres sigue sin email. */
export async function cargarIdentidadesVendedoras(ids: string[], conCorreos: boolean) {
  const map = new Map<string, IdentidadVendedora>();
  if (!ids.length) return map;
  try {
    const users = conCorreos ? await fetchAvailableUsers() : await fetchNombresUsuarios();
    for (const id of ids) {
      const user = users.find((u) => u.id === id);
      map.set(id, identidadDesdeUsuario(user, conCorreos));
    }
  } catch {
    for (const id of ids) map.set(id, {
      nombre: UNRESOLVED_EMAIL, email: null,
      estadoIdentidad: "error_consulta", identidadResuelta: false,
    });
  }
  // Dos etiquetas iguales sin correo que permita distinguirlas no autorizan
  // una selección financiera a ciegas.
  marcarEtiquetasAmbiguas(map);
  return map;
}

export function etiquetaVendedora(v: { nombre: string; email?: string | null }) {
  return v.email && v.email !== v.nombre ? `${v.nombre} (${v.email})` : v.nombre;
}
