/**
 * Detecta puertos y navieras de las tarifas del correo que no existen en el
 * catálogo, y separa las filas que sólo esperan esas altas (pendientes).
 */
import type { CatalogosImport } from "../importarTarifas";
import type { FilaCorreo } from "./comun";

const norm = (v: unknown) => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

export interface Faltantes { puertos: string[]; navieras: string[]; pendientes: FilaCorreo[] }

export function faltantesDeCatalogo(filas: readonly FilaCorreo[], c: Pick<CatalogosImport, "puertos" | "navieras">): Faltantes {
  const hayPuerto = (v: string) => c.puertos.some((p) => norm(p.code) === norm(v) || norm(p.name) === norm(v));
  const hayNaviera = (v: string) => c.navieras.some((n) => norm(n.name) === norm(v) || norm(n.code) === norm(v));
  const puertos = new Map<string, string>();
  const navieras = new Map<string, string>();
  const pendientes: FilaCorreo[] = [];
  for (const f of filas) {
    let falta = false;
    for (const p of [f.Origen, f.Destino]) {
      if (p.trim() && !hayPuerto(p)) { puertos.set(norm(p), p.trim()); falta = true; }
    }
    if (f.Naviera.trim() && !hayNaviera(f.Naviera)) { navieras.set(norm(f.Naviera), f.Naviera.trim()); falta = true; }
    if (falta) pendientes.push(f);
  }
  return { puertos: [...puertos.values()], navieras: [...navieras.values()], pendientes };
}
