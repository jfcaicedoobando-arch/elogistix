/**
 * Importación masiva de clientes por lotes (N-05, QA r2).
 *
 * Analogía: en vez de llevar 1000 sobres al correo uno por uno, se llevan
 * cajas de 200. Un solo `insert` con arreglo por lote (5 viajes en vez de
 * 1000). Si un lote falla, el error dice cuántos clientes ya quedaron
 * guardados para que el usuario sepa dónde quedó la carga.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables, TablesInsert } from "@/integrations/supabase/types";
import { normalizarRazonSocial } from "@/lib/text/razonSocial";
import { IMPORT_LOTE_TAMANO } from "@/lib/csv/importLimits";
import { getErrorMessage } from "@/lib/errors";

type Cliente = Tables<"clientes">;

export async function createClientesLote(
  clientes: TablesInsert<"clientes">[],
  onProgreso?: (insertados: number) => void,
): Promise<Cliente[]> {
  const creados: Cliente[] = [];
  for (let i = 0; i < clientes.length; i += IMPORT_LOTE_TAMANO) {
    const lote = clientes
      .slice(i, i + IMPORT_LOTE_TAMANO)
      .map((c) => ({ ...c, nombre: normalizarRazonSocial(c.nombre) }));
    const { data, error } = await supabase.rpc("crear_clientes", {
      // SAFE-CAST: filas ya validadas por el importador; la RPC recibe jsonb.
      p_clientes: lote as unknown as Json,
    });
    if (error) {
      throw new Error(
        `Se importaron ${creados.length} de ${clientes.length} clientes; el siguiente lote falló: ${getErrorMessage(error)}`,
      );
    }
    creados.push(...((data ?? []) as Cliente[]));
    onProgreso?.(creados.length);
  }
  return creados;
}
