/**
 * Tipos de rutas dot-path para `genericPayloadMapper`. Aislados aquí para
 * mantener el archivo principal bajo el límite Power-of-10 (≤200 líneas).
 */
import type { ZodType } from "zod";

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

export interface PayloadMapper<Form, Row> {
  toDb: (form: Form) => Row;
  fromDb: (row: Row) => Form;
}
