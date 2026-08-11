/**
 * Resolución del proveedor del catálogo a partir del nombre en texto libre.
 *
 * Los costos replicados desde una cotización sólo traen el nombre del
 * proveedor (`proveedor_nombre`), nunca su UUID. Sin esta resolución el
 * wizard de edición mostraba el campo Proveedor vacío y, al guardar, borraba
 * el nombre original (v13.509.0).
 */

export interface ProveedorCatalogo {
  id: string;
  nombre: string;
}

const norm = (v: string | null | undefined) => (v ?? "").trim().toUpperCase();

/**
 * Devuelve el id del proveedor cuyo nombre coincide exacto o, en su defecto,
 * el único que empieza con el nombre dado. Si hay ambigüedad devuelve "".
 */
export function resolverProveedorIdPorNombre(
  nombre: string | null | undefined,
  proveedores: ReadonlyArray<ProveedorCatalogo>,
): string {
  const buscado = norm(nombre);
  if (!buscado) return "";

  const exacto = proveedores.find((p) => norm(p.nombre) === buscado);
  if (exacto) return exacto.id;

  const prefijo = proveedores.filter((p) => norm(p.nombre).startsWith(buscado));
  return prefijo.length === 1 ? prefijo[0].id : "";
}
