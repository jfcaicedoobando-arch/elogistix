/**
 * Helpers para desestructurar respuestas de Supabase eliminando el boilerplate
 * `const { data, error } = await ...; if (error) throw error; return data;`
 * que aparecía en ~400 sitios.
 *
 * Contrato:
 * - Cualquier `PostgrestError` (o error de RPC / edge invoke) se re-lanza sin
 *   modificar. Esto preserva el comportamiento previo: el hook `useMutation`
 *   captura el error y `handleSupabaseError` / `useMutationWithFeedback` lo
 *   muestran al usuario.
 * - `unwrap(builder)` devuelve `data` (puede ser `null` para `.maybeSingle()`).
 * - `unwrapOr(builder, fallback)` devuelve `data ?? fallback` (útil para listas
 *   donde el fallback natural es `[]`).
 * - `run(builder)` ignora `data` y sólo verifica el error (INSERT/UPDATE/DELETE
 *   sin `.select()`).
 *
 * Ejemplo:
 *   // Antes
 *   const { data, error } = await supabase.from("navieras").select("*");
 *   if (error) throw error;
 *   return data ?? [];
 *
 *   // Después
 *   return unwrapOr(supabase.from("navieras").select("*"), []);
 */
import type {
  PostgrestSingleResponse,
  PostgrestMaybeSingleResponse,
  PostgrestResponse,
} from "@supabase/supabase-js";

/** Extrae `data` y re-lanza si hay error. Overloads permiten a TS elegir la
 *  variante correcta (single → T, maybeSingle → T|null, select → T[]|null)
 *  antes de caer al fallback estructural. */
export async function unwrap<T>(builder: PromiseLike<PostgrestSingleResponse<T>>): Promise<T>;
export async function unwrap<T>(builder: PromiseLike<PostgrestMaybeSingleResponse<T>>): Promise<T | null>;
export async function unwrap<T>(builder: PromiseLike<PostgrestResponse<T>>): Promise<T[] | null>;
export async function unwrap<T>(builder: PromiseLike<{ data: T | null; error: unknown }>): Promise<T>;
export async function unwrap(builder: PromiseLike<{ data: unknown; error: unknown }>): Promise<unknown> {
  const { data, error } = await builder;
  if (error) throw error;
  return data;
}

/** Extrae `data ?? fallback` y re-lanza si hay error. */
export async function unwrapOr<T>(builder: PromiseLike<PostgrestSingleResponse<T>>, fallback: T): Promise<T>;
export async function unwrapOr<T>(builder: PromiseLike<PostgrestMaybeSingleResponse<T>>, fallback: T): Promise<T>;
export async function unwrapOr<T>(builder: PromiseLike<PostgrestResponse<T>>, fallback: T[]): Promise<T[]>;
export async function unwrapOr<T>(builder: PromiseLike<{ data: T | null; error: unknown }>, fallback: T): Promise<T>;
export async function unwrapOr(
  builder: PromiseLike<{ data: unknown; error: unknown }>,
  fallback: unknown,
): Promise<unknown> {
  const { data, error } = await builder;
  if (error) throw error;
  return data ?? fallback;
}

/** Ejecuta la operación y re-lanza si hay error. Ignora `data`. */
export async function run(builder: PromiseLike<{ error: unknown }>): Promise<void> {
  const { error } = await builder;
  if (error) throw error;
}
