/**
 * Importación masiva de proveedores por lotes (N-05, QA r2).
 *
 * Un `insert` con arreglo por lote de 200 (5 viajes por cada 1000 filas en vez
 * de 1000). Si el lote choca con el índice único de RFC (23505) se reintenta
 * fila por fila para conservar el mensaje de duplicado con el proveedor
 * existente (`ProveedorDuplicadoError`) y no perder las filas buenas.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { normalizarRazonSocial } from "@/lib/text/razonSocial";
import { IMPORT_LOTE_TAMANO } from "@/lib/csv/importLimits";
import { getErrorMessage } from "@/lib/errors";
import { insertProveedor } from "./proveedoresCrud";

type Proveedor = Tables<"proveedores">;

async function insertarLote(
  lote: TablesInsert<"proveedores">[],
  yaInsertados: number,
  total: number,
): Promise<Proveedor[]> {
  const payload = lote.map((p) => ({ ...p, nombre: normalizarRazonSocial(p.nombre) }));
  const { data, error } = await supabase.from("proveedores").insert(payload).select();
  if (!error) return (data ?? []) as Proveedor[];
  // 23505 = unique_violation (proveedores_org_rfc_unique): reintento fila a fila
  // para que el error identifique al proveedor duplicado.
  if ((error as { code?: string }).code === "23505") {
    const creados: Proveedor[] = [];
    for (const p of lote) creados.push(await insertProveedor(p));
    return creados;
  }
  throw new Error(
    `Se importaron ${yaInsertados} de ${total} proveedores; el siguiente lote falló: ${getErrorMessage(error)}`,
  );
}

export async function insertProveedoresLote(
  proveedores: TablesInsert<"proveedores">[],
  onProgreso?: (insertados: number) => void,
): Promise<Proveedor[]> {
  const creados: Proveedor[] = [];
  for (let i = 0; i < proveedores.length; i += IMPORT_LOTE_TAMANO) {
    const lote = proveedores.slice(i, i + IMPORT_LOTE_TAMANO);
    creados.push(...(await insertarLote(lote, creados.length, proveedores.length)));
    onProgreso?.(creados.length);
  }
  return creados;
}
