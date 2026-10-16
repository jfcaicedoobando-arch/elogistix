/** Espejo de las políticas INSERT de puertos/navieras/tipos_contenedor (la base decide). */
const ROLES_ALTA_CATALOGO = new Set(["gerente_operaciones", "admin", "admin_org", "super_admin"]);

export function puedeDarAltaCatalogo(role: string | null | undefined): boolean {
  return !!role && ROLES_ALTA_CATALOGO.has(role);
}
