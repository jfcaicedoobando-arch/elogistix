/**
 * Boundary casts entre Supabase y nuestros tipos de dominio.
 *
 * **Esta es la ÚNICA ubicación permitida para `as unknown as T`** en código
 * productivo. Centraliza la deuda técnica de validación de boundaries para
 * que la migración a validación runtime (Zod) sea un cambio en este archivo,
 * no en 50 call sites.
 *
 * Por qué es necesario:
 * - Supabase autogenera tipos con `Json` (estructura recursiva genérica)
 *   donde nosotros guardamos arrays/objetos tipados (conceptos_venta,
 *   dimensiones_lcl, etc.). El compilador no puede inferir el shape real.
 * - Algunos joins (`select foo, bar(*)`) devuelven shapes que TS infiere
 *   como `unknown` o como una unión imposible.
 * - Las RPCs (`supabase.rpc()`) reciben payloads `Json` y devuelven `unknown`.
 *
 * Uso (cast crudo, sin validación):
 *   const rows = fromDb<CotizacionRow[]>(data ?? []);
 *
 * Uso (con validación runtime, recomendado en boundaries críticos):
 *   const result = fromDb({ id: "..." }, z.object({ id: z.string().uuid() }));
 *   //    ^? { id: string }   — el tipo se infiere del schema
 *
 * NUNCA escribas `as unknown as X` fuera de este archivo. El audit
 * (scripts/audit-casts.ts) marca esos casts como HIGH y deben reemplazarse
 * por uno de estos helpers.
 *
 * Roadmap (docs/strict-mode-roadmap.md § Fase B.2 ✅):
 * - [x] `fromDb` acepta un Zod schema opcional y valida en runtime cuando
 *       se proporciona. Si la validación falla, lanza `ZodError` con el path
 *       exacto del campo inválido (mejor que el `undefined` silencioso).
 * - [x] Adoptado en hotspots: `services/embarque/mutations.ts` (RPCs) y
 *       `services/portal/queries.ts` (joins anidados).
 */
import type { ZodType } from "zod";
import type { Json } from "@/integrations/supabase/types";

/**
 * Convierte una respuesta cruda de Supabase al tipo de dominio esperado.
 *
 * Sobrecarga 1: con schema Zod → valida en runtime y devuelve el tipo
 * inferido del schema. Lanza `ZodError` si el payload no cumple.
 *
 * Sobrecarga 2: sin schema → cast crudo (deuda técnica documentada).
 *
 * @example
 * // Validación runtime (preferido en boundaries críticos):
 * const ids = fromDb(data, z.array(z.object({ id: z.string().uuid() })));
 *
 * @example
 * // Cast crudo (cuando el shape es enorme o ya está tipado por Supabase):
 * const rows = fromDb<CotizacionRow[]>(data ?? []);
 */
export function fromDb<S extends ZodType>(data: unknown, schema: S): import("zod").infer<S>;
export function fromDb<T>(data: unknown): T;
export function fromDb<T>(data: unknown, schema?: ZodType<T>): T {
  if (schema) return schema.parse(data) as T;
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
