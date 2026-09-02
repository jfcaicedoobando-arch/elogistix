/**
 * Importación masiva de clientes por lotes (N-05, QA r2).
 *
 * Analogía: en vez de llevar 1000 sobres al correo uno por uno, se llevan
 * cajas de 200. Un solo `insert` con arreglo por lote (5 viajes en vez de
 * 1000). Si un lote falla, el error dice cuántos clientes ya quedaron
 * guardados para que el usuario sepa dónde quedó la carga.
 *
 * Defecto 4: antes de escribir se consultan los clientes ya existentes (por RFC
 * o razón social) y se omiten. Así reintentar el mismo archivo tras un corte
 * parcial no duplica altas y el conteo final refleja lo realmente creado.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables, TablesInsert } from "@/integrations/supabase/types";
import { normalizarRazonSocial } from "@/lib/text/razonSocial";
import { IMPORT_LOTE_TAMANO } from "@/lib/csv/importLimits";
import {
  claveImport,
  enTrozos,
  separarDuplicados,
  type ResultadoImportLote,
} from "@/lib/csv/dedupeImportLote";
import { getErrorMessage } from "@/lib/errors";

type Cliente = Tables<"clientes">;

async function clavesExistentes(
  clientes: readonly TablesInsert<"clientes">[],
): Promise<Set<string>> {
  const claves = new Set<string>();
  const rfcs = [
    ...new Set(
      clientes
        .map((c) => (c.rfc ?? "").trim().toUpperCase())
        .filter((r) => r !== ""),
    ),
  ];
  const nombres = [
    ...new Set(clientes.map((c) => normalizarRazonSocial(c.nombre))),
  ];
  const agregar = (rows: { nombre: string; rfc: string | null }[]): void => {
    for (const r of rows) claves.add(claveImport(r.nombre, r.rfc));
  };
  for (const trozo of enTrozos(rfcs)) {
    const { data, error } = await supabase
      .from("clientes")
      .select("nombre, rfc")
      .is("deleted_at", null)
      .in("rfc", trozo);
    if (error) throw new Error(getErrorMessage(error));
    agregar(data ?? []);
  }
  for (const trozo of enTrozos(nombres)) {
    const { data, error } = await supabase
      .from("clientes")
      .select("nombre, rfc")
      .is("deleted_at", null)
      .in("nombre", trozo);
    if (error) throw new Error(getErrorMessage(error));
    // Un cliente existente con RFC se identifica por RFC; su nombre también
    // bloquea el alta de una fila sin RFC con la misma razón social.
    for (const r of data ?? []) claves.add(claveImport(r.nombre, null));
    agregar(data ?? []);
  }
  return claves;
}

export async function createClientesLote(
  clientes: TablesInsert<"clientes">[],
  onProgreso?: (insertados: number) => void,
): Promise<ResultadoImportLote<Cliente>> {
  const normalizados = clientes.map((c) => ({
    ...c,
    nombre: normalizarRazonSocial(c.nombre),
  }));
  const existentes = await clavesExistentes(normalizados);
  const { unicos, omitidos } = separarDuplicados(
    normalizados,
    (c) => claveImport(c.nombre, c.rfc),
    existentes,
  );

  const creados: Cliente[] = [];
  for (let i = 0; i < unicos.length; i += IMPORT_LOTE_TAMANO) {
    const lote = unicos.slice(i, i + IMPORT_LOTE_TAMANO);
    const { data, error } = await supabase.rpc("crear_clientes", {
      // SAFE-CAST: filas ya validadas por el importador; la RPC recibe jsonb.
      p_clientes: lote as unknown as Json,
    });
    if (error) {
      throw new Error(
        `Se importaron ${creados.length} de ${unicos.length} clientes; el siguiente lote falló: ${getErrorMessage(error)}`,
      );
    }
    creados.push(...((data ?? []) as Cliente[]));
    onProgreso?.(creados.length);
  }
  return { creados, omitidos: omitidos.length };
}
