/**
 * genericPayloadMapper — Utilidad genérica reusable para mapear payloads
 * Form ↔ Row (BD) de forma declarativa y tipada.
 *
 * Reemplaza el patrón repetitivo de pares `xxxFromDb.ts` / `xxxToDb.ts`
 * (embarques, cotizaciones, etc.) con un schema único de rutas estructurales.
 *
 * Diseño:
 * - `DotPath<T>`: unión literal de las rutas válidas dentro de `T`
 *   (limitada a 4 niveles para no romper el checker).
 * - `FieldMap`: par (ruta form ↔ ruta row) con `coerce` opcional y `direction`.
 * - `createPayloadMapper`: produce `{ toDb, fromDb }` que recorren los fields,
 *   aplican coerciones, y ejecutan hooks `computedToDb` / `computedFromDb`
 *   para lógica derivada (ej. totales, resolver contacto).
 *
 * Seguridad runtime: `rowSchema` / `formSchema` opcionales (Zod) validan
 * el resultado final y lanzan `ZodError` con path exacto, mismo patrón que
 * `src/lib/supabase/cast.ts`.
 *
 * Ejemplo:
 *   const mapper = createPayloadMapper<EmbarqueForm, EmbarqueRow>({
 *     fields: [
 *       F.str("clienteId", "cliente_id"),
 *       F.num("pesoKg", "peso_kg"),
 *       F.enum("modo", "modo", modoEmbarqueSchema),
 *       F.emptyNull("blMaster", "bl_master"),
 *     ],
 *     computedToDb: (v, p) => ({ ...p, ...totalesDesdeContenedores(v) }),
 *   });
 *   const row = mapper.toDb(formValues);
 */
import type { ZodType } from "zod";
import { str, num, emptyToNull } from "./_helpers";

// ───────────────────────────────────────────────────────────────────────────
// Tipos de rutas (dot-path) limitadas a 4 niveles
// ───────────────────────────────────────────────────────────────────────────

type Prev = [never, 0, 1, 2, 3, 4];

type Primitive = string | number | boolean | bigint | symbol | null | undefined;

export type DotPath<T, Depth extends number = 4> =
  [Depth] extends [never]
    ? never
    : T extends Primitive
      ? never
      : T extends readonly unknown[]
        ? never
        : {
            [K in keyof T & string]:
              | K
              | (T[K] extends Primitive
                  ? never
                  : `${K}.${DotPath<T[K], Prev[Depth]>}`);
          }[keyof T & string];

export type PathValue<T, P extends string> =
  P extends `${infer K}.${infer Rest}`
    ? K extends keyof T
      ? PathValue<T[K], Rest>
      : never
    : P extends keyof T
      ? T[P]
      : never;

// ───────────────────────────────────────────────────────────────────────────
// Schema declarativo
// ───────────────────────────────────────────────────────────────────────────

export type MapDirection = "both" | "toDb" | "fromDb";

export interface FieldMap<Form, Row> {
  /** Ruta en el objeto form (`"clienteId"`, `"datos.nombre"`). */
  formPath: DotPath<Form>;
  /** Ruta en el objeto row de BD (`"cliente_id"`). */
  rowPath: DotPath<Row>;
  /** Coerción aplicada al moverse hacia BD. Si se omite, copia el valor tal cual. */
  toDb?: (v: unknown) => unknown;
  /** Coerción aplicada al moverse desde BD. Si se omite, copia el valor tal cual. */
  fromDb?: (v: unknown) => unknown;
  /** Default: por defecto `"both"`. */
  direction?: MapDirection;
}

export interface MapperSchema<Form, Row> {
  fields: ReadonlyArray<FieldMap<Form, Row>>;
  /** Hook tras aplicar fields hacia BD (ej. totales derivados, resolver contacto). */
  computedToDb?: (form: Form, partial: Partial<Row>) => Partial<Row>;
  /** Hook tras aplicar fields hacia form. */
  computedFromDb?: (row: Row, partial: Partial<Form>) => Partial<Form>;
  /** Validación runtime opcional del payload final hacia BD. */
  rowSchema?: ZodType<Row>;
  /** Validación runtime opcional del payload final hacia form. */
  formSchema?: ZodType<Form>;
}

// ───────────────────────────────────────────────────────────────────────────
// get / set por dot-path (SAFE-CAST aislados aquí)
// ───────────────────────────────────────────────────────────────────────────

// SAFE-CAST: el acceso por path es genuinamente dinámico; los tipos públicos
// `DotPath` / `PathValue` ya garantizan validez en compile-time del schema.
function getPath(obj: unknown, path: string): unknown {
  if (obj == null) return undefined;
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

// SAFE-CAST: idem getPath. Muta `target` (que es siempre un objeto recién
// creado dentro de `runFields`, nunca el input del consumidor).
function setPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  const last = parts.pop();
  if (!last) return;
  let cur = target;
  for (const p of parts) {
    const next = cur[p];
    if (next == null || typeof next !== "object") {
      cur[p] = {};
    }
    cur = cur[p] as Record<string, unknown>;
  }
  cur[last] = value;
}

// ───────────────────────────────────────────────────────────────────────────
// DSL `F.*` — atajos para los coerce más comunes
// ───────────────────────────────────────────────────────────────────────────

type FBuilder<Form, Row> = (
  formPath: DotPath<Form>,
  rowPath: DotPath<Row>,
) => FieldMap<Form, Row>;

export const F = {
  /** Copia directa sin coerción (útil cuando los tipos ya coinciden). */
  raw: <Form, Row>(): FBuilder<Form, Row> => (formPath, rowPath) => ({
    formPath, rowPath,
  }),
  /** Coerciona a `string` en ambas direcciones (con default opcional). */
  str: <Form, Row>(def = ""): FBuilder<Form, Row> => (formPath, rowPath) => ({
    formPath, rowPath,
    toDb: (v) => str(v, def),
    fromDb: (v) => str(v, def),
  }),
  /** Coerciona a `number` hacia BD; a `string` hacia form (patrón RHF). */
  num: <Form, Row>(def = 0): FBuilder<Form, Row> => (formPath, rowPath) => ({
    formPath, rowPath,
    toDb: (v) => num(v, def),
    fromDb: (v) => (v === null || v === undefined ? "" : String(v)),
  }),
  /** Convierte "" → null al ir a BD (típico en columnas nullable). */
  emptyNull: <Form, Row>(): FBuilder<Form, Row> => (formPath, rowPath) => ({
    formPath, rowPath,
    toDb: (v) => emptyToNull(v as string | null | undefined),
    fromDb: (v) => str(v),
  }),
  /** Valida con un Zod schema (típico para enums) al ir a BD. */
  zod: <Form, Row>(schema: ZodType): FBuilder<Form, Row> => (formPath, rowPath) => ({
    formPath, rowPath,
    toDb: (v) => schema.parse(v),
    fromDb: (v) => v,
  }),
} as const;

// ───────────────────────────────────────────────────────────────────────────
// Factoría principal
// ───────────────────────────────────────────────────────────────────────────

function runFields<Src, Dst>(
  source: Src,
  fields: ReadonlyArray<FieldMap<Src, Dst> | FieldMap<Dst, Src>>,
  direction: "toDb" | "fromDb",
): Partial<Dst> {
  const out: Record<string, unknown> = {};
  for (const f of fields as ReadonlyArray<FieldMap<Src, Dst>>) {
    const dir = f.direction ?? "both";
    if (dir !== "both" && dir !== direction) continue;
    const [srcPath, dstPath, coerce] =
      direction === "toDb"
        ? [f.formPath, f.rowPath, f.toDb]
        : [f.rowPath, f.formPath, f.fromDb];
    const raw = getPath(source, srcPath as string);
    const value = coerce ? coerce(raw) : raw;
    setPath(out, dstPath as string, value);
  }
  return out as Partial<Dst>;
}

export interface PayloadMapper<Form, Row> {
  toDb: (form: Form) => Row;
  fromDb: (row: Row) => Form;
}

export function createPayloadMapper<Form, Row>(
  schema: MapperSchema<Form, Row>,
): PayloadMapper<Form, Row> {
  return {
    toDb(form) {
      let partial = runFields<Form, Row>(form, schema.fields, "toDb");
      if (schema.computedToDb) {
        partial = { ...partial, ...schema.computedToDb(form, partial) };
      }
      // SAFE-CAST: el shape final se valida con `rowSchema` si se proveyó.
      const result = partial as Row;
      return schema.rowSchema ? schema.rowSchema.parse(result) : result;
    },
    fromDb(row) {
      let partial = runFields<Row, Form>(row, schema.fields as ReadonlyArray<FieldMap<Row, Form>>, "fromDb");
      if (schema.computedFromDb) {
        partial = { ...partial, ...schema.computedFromDb(row, partial) };
      }
      // SAFE-CAST: idem.
      const result = partial as Form;
      return schema.formSchema ? schema.formSchema.parse(result) : result;
    },
  };
}
