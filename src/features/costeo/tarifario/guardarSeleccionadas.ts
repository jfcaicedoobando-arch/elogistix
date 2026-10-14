/**
 * Guarda en borrador las tarifas seleccionadas, creando las rutas que falten.
 * Regresa cuántas entraron y los errores por renglón; los renglones con error
 * no se tocan y quedan visibles para corregirse.
 */
import { insertCosteoRuta } from "@/features/costeo/services/rutas";
import { insertTarifaConRecargos } from "@/features/costeo/services/tarifas";
import type { TarifaImport } from "./importarTarifas";

export async function guardarSeleccionadas(
  organizationId: string,
  seleccion: Set<number>,
  tarifas: TarifaImport[],
): Promise<{ creadas: number; errores: string[] }> {
  const rutas = new Map<string, string>();
  const errores: string[] = [];
  let creadas = 0;
  for (const t of tarifas.filter((_, i) => seleccion.has(i))) {
    try {
      let rutaId = t.input.ruta_id;
      if (!rutaId) {
        const k = `${t.origenId}>${t.destinoId}`;
        rutaId = rutas.get(k) ?? (await insertCosteoRuta(organizationId, { puerto_origen_id: t.origenId, puerto_destino_id: t.destinoId })).id;
        rutas.set(k, rutaId);
      }
      await insertTarifaConRecargos(organizationId, { ...t.input, ruta_id: rutaId });
      creadas += 1;
    } catch (e) {
      errores.push(`Fila ${t.fila}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { creadas, errores };
}
