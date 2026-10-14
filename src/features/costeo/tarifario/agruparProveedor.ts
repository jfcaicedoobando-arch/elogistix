/** Agrupa tarifas por proveedor (o agente) para la lista desplegable del diálogo. */
import type { TarifaImport } from "./importarTarifas";

export interface GrupoProveedor { proveedor: string; indices: number[] }

/**
 * Devuelve los grupos en orden de primera aparición; `indices` apunta a la
 * posición de cada tarifa dentro del arreglo original. Si el agente no
 * pertenece a un proveedor del correo, se agrupa bajo el nombre del agente.
 */
export function agruparPorProveedor(
  tarifas: ReadonlyArray<TarifaImport>,
  proveedorDe: ReadonlyMap<string, string>,
  nombreAgenteDe: ReadonlyMap<string, string>,
): GrupoProveedor[] {
  const orden: GrupoProveedor[] = [];
  const porNombre = new Map<string, GrupoProveedor>();
  tarifas.forEach((t, i) => {
    const nombre = proveedorDe.get(t.input.agente_id) ?? nombreAgenteDe.get(t.input.agente_id) ?? "Otro agente";
    let g = porNombre.get(nombre);
    if (!g) { g = { proveedor: nombre, indices: [] }; porNombre.set(nombre, g); orden.push(g); }
    g.indices.push(i);
  });
  return orden;
}
