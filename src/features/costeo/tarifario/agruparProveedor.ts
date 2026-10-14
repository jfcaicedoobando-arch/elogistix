/** Agrupa tarifas por proveedor (o agente) para la lista desplegable del diálogo. */
import { AGENTE_CLAVE, NOMBRE_PROVEEDOR, type ProveedorCorreo } from "./correo/proveedoresCorreo";
import type { TarifaImport } from "./importarTarifas";

export interface GrupoProveedor { proveedor: string; indices: number[] }

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

/** Relaciona cada agente del catálogo con su proveedor de correo (si existe). */
export function mapearAgentes(agentes: ReadonlyArray<{ id: string; nombre: string }>): {
  proveedorDe: Map<string, string>; nombreAgenteDe: Map<string, string>;
} {
  const proveedorDe = new Map<string, string>();
  const nombreAgenteDe = new Map<string, string>();
  for (const ag of agentes) {
    nombreAgenteDe.set(ag.id, ag.nombre);
    for (const [prov, clave] of Object.entries(AGENTE_CLAVE)) {
      if (norm(ag.nombre).includes(norm(clave))) { proveedorDe.set(ag.id, NOMBRE_PROVEEDOR[prov as ProveedorCorreo] ?? prov); break; }
    }
  }
  return { proveedorDe, nombreAgenteDe };
}

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
