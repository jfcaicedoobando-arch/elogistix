/**
 * Importación masiva de proveedores por lotes (N-05, QA r2).
 *
 * Un `insert` con arreglo por lote de 200 (5 viajes por cada 1000 filas en vez
 * de 1000). Si el lote choca con el índice único de RFC (23505) se reintenta
 * fila por fila para conservar el mensaje de duplicado con el proveedor
 * existente (`ProveedorDuplicadoError`) y no perder las filas buenas.
 *
 * Defecto 4: los proveedores que ya existen (por RFC o razón social) se omiten
 * ANTES de escribir, así reintentar el mismo archivo tras un corte parcial no
 * duplica altas y el conteo final refleja lo realmente creado.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { normalizarRazonSocial } from "@/lib/text/razonSocial";
import { IMPORT_LOTE_TAMANO } from "@/lib/csv/importLimits";
import {
  claveImport,
  enTrozos,
  separarDuplicados,
  type ResultadoImportLote,
} from "@/lib/csv/dedupeImportLote";
import { getErrorMessage } from "@/lib/errors";
import { insertProveedor } from "./proveedoresCrud";

type Proveedor = Tables<"proveedores">;

async function clavesExistentes(
  proveedores: readonly TablesInsert<"proveedores">[],
): Promise<Set<string>> {
  const claves = new Set<string>();
  const rfcs = [
    ...new Set(
      proveedores
        .map((p) => (p.rfc ?? "").trim().toUpperCase())
        .filter((r) => r !== ""),
    ),
  ];
  const nombres = [
    ...new Set(proveedores.map((p) => normalizarRazonSocial(p.nombre))),
  ];
  for (const trozo of enTrozos(rfcs)) {
    const { data, error } = await supabase
      .from("proveedores")
      .select("nombre, rfc")
      .is("deleted_at", null)
      .in("rfc", trozo);
    if (error) throw new Error(getErrorMessage(error));
    for (const r of data ?? []) claves.add(claveImport(r.nombre, r.rfc));
  }
  for (const trozo of enTrozos(nombres)) {
    const { data, error } = await supabase
      .from("proveedores")
      .select("nombre, rfc")
      .is("deleted_at", null)
      .in("nombre", trozo);
    if (error) throw new Error(getErrorMessage(error));
    for (const r of data ?? []) {
      claves.add(claveImport(r.nombre, r.rfc));
      claves.add(claveImport(r.nombre, null));
    }
  }
  return claves;
}

async function insertarLote(
  lote: TablesInsert<"proveedores">[],
  yaInsertados: number,
  total: number,
): Promise<Proveedor[]> {
  const { data, error } = await supabase.from("proveedores").insert(lote).select();
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
): Promise<ResultadoImportLote<Proveedor>> {
  const normalizados = proveedores.map((p) => ({
    ...p,
    nombre: normalizarRazonSocial(p.nombre),
  }));
  const existentes = await clavesExistentes(normalizados);
  const { unicos, omitidos } = separarDuplicados(
    normalizados,
    (p) => claveImport(p.nombre, p.rfc),
    existentes,
  );

  const creados: Proveedor[] = [];
  for (let i = 0; i < unicos.length; i += IMPORT_LOTE_TAMANO) {
    const lote = unicos.slice(i, i + IMPORT_LOTE_TAMANO);
    creados.push(...(await insertarLote(lote, creados.length, unicos.length)));
    onProgreso?.(creados.length);
  }
  return { creados, omitidos: omitidos.length };
}
