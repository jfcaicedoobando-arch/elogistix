/**
 * Boundary casts entre Supabase y nuestros tipos de dominio.
 *
 * **Esta es la ÚNICA ubicación permitida para `as unknown as T`** en código
 * productivo. Centraliza la deuda técnica de validación de boundaries para
 * que la migración futura a Zod (Fase B.2 del strict-mode roadmap) sea un
 * cambio en este archivo, no en 50 call sites.
 *
 * Por qué es necesario:
 * - Supabase autogenera tipos con `Json` (estructura recursiva genérica)
 *   donde nosotros guardamos arrays/objetos tipados (conceptos_venta,
 *   dimensiones_lcl, etc.). El compilador no puede inferir el shape real.
 * - Algunos joins (`select foo, bar(*)`) devuelven shapes que TS infiere
 *   como `unknown` o como una unión imposible.
 * - Las RPCs (`supabase.rpc()`) reciben payloads `Json` y devuelven `unknown`.
 *
 * Uso:
 *   const rows = fromDb<CotizacionRow[]>(data ?? []);
 *   const payload = toDbJson(input.conceptos_venta);
 *
 * NUNCA escribas `as unknown as X` fuera de este archivo. El audit
 * (scripts/audit-casts.ts) marca esos casts como HIGH y deben reemplazarse
 * por uno de estos helpers.
 *
 * Roadmap (docs/strict-mode-roadmap.md § Fase B.2):
 * - [ ] `fromDb` debería aceptar un parser opcional (Zod schema o type guard)
 *       y validar en runtime cuando se proporcione.
 * - [ ] Adoptar Zod en los services hotspot (cotizacion/crud, embarque/mutations)
 *       y eliminar el cast crudo allí.
 */
import type { Database } from "@/integrations/supabase/types";

type Json = Database["public"]["Tables"] extends never
  ? unknown
  : Database extends { public: { CompositeTypes: infer _ } }
    ? unknown
    : unknown;

/**
 * Convierte una respuesta cruda de Supabase al tipo de dominio esperado.
 *
 * @example
 * const { data } = await supabase.from("cotizaciones").select("*");
 * return fromDb<CotizacionRow[]>(data ?? []);
 */
export function fromDb<T>(data: unknown): T {
  return data as T;
}

/**
 * Convierte un valor de dominio (objeto/array tipado) a `Json` para insertarlo
 * en una columna `jsonb` de Supabase o como payload de RPC.
 *
 * @example
 * await supabase.from("cotizaciones").insert({
 *   conceptos_venta: toDbJson(input.conceptos_venta),
 * });
 */
export function toDbJson<T>(value: T): Json {
  return value as Json;
}
