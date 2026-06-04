# Plan: `genericPayloadMapper.ts` — Mapeador genérico reusable

## Objetivo

Reemplazar el patrón repetitivo de los pares `xxxFromDb.ts` / `xxxToDb.ts` (hoy: `embarque*`, `cotizacion*`, `cotizacionForm`, etc.) por una utilidad única, declarativa y tipada que reciba un **schema de rutas** y produzca funciones de mapeo bidireccionales seguras en compile-time.

No reescribiremos los mappers existentes en este PR — sólo construimos la herramienta, sus tipos, sus helpers y sus tests. La migración de `embarqueToDb` / `embarqueFromDb` quedará como segundo PR opcional para evitar regresiones en wizard de embarques.

## Alcance de este PR

1. **Nuevo módulo**: `src/lib/mappers/genericPayloadMapper.ts`
2. **Tests**: `src/lib/mappers/__tests__/genericPayloadMapper.test.ts`
3. **Doc corta** en JSDoc dentro del archivo + sección en `docs/strict-mode-roadmap.md` referenciando el patrón.
4. **NO** se tocan `embarqueToDb.ts`, `embarqueFromDb.ts`, ni consumidores. Sin cambios de comportamiento productivo.

## Diseño técnico

### API pública

```ts
// Una "ruta estructural" = par (clave dominio ↔ ruta dot-path BD)
// con coerciones opcionales y default.
export interface FieldMap<Src, Dst> {
  from: DotPath<Src>;          // ruta tipada dentro del objeto fuente
  to:   DotPath<Dst>;          // ruta tipada dentro del objeto destino
  coerce?: (v: unknown) => unknown;  // ej. str, num, emptyToNull
  default?: unknown;
  // Direccionalidad opcional para campos read-only o write-only:
  direction?: "both" | "toDb" | "fromDb";
}

export interface MapperSchema<Form, Row> {
  fields: ReadonlyArray<FieldMap<Form, Row> | FieldMap<Row, Form>>;
  // Hooks para lógica derivada que no encaja en field-by-field
  // (ej. resolverContacto, totalesDesdeContenedores).
  computedToDb?:   (form: Form, partial: Partial<Row>) => Partial<Row>;
  computedFromDb?: (row: Row,  partial: Partial<Form>) => Partial<Form>;
}

export function createPayloadMapper<Form, Row>(
  schema: MapperSchema<Form, Row>
): {
  toDb:   (form: Form) => Row;
  fromDb: (row: Row)   => Form;
};
```

### Tipos auxiliares (genéricos)

- `DotPath<T>`: recursive mapped type que produce una unión literal `"a" | "a.b" | "a.b.c"` con las rutas válidas de `T` (limitado a 4 niveles para evitar explosión del checker; los mappers reales no exceden 2).
- `PathValue<T, P extends DotPath<T>>`: extrae el tipo del valor en esa ruta. Usado para que `coerce` sea opcional cuando los tipos ya coinciden.
- Validación en compile-time: si `from` apunta a `string` y `to` a `number` sin `coerce`, error de tipos.

### Helpers integrados

Reusar `_helpers.ts` (`str`, `num`, `emptyToNull`, `nullable`) como `coerce` listos. Exportar también un mini-DSL:

```ts
export const F = {
  str:  (from, to, def="")     => ({ from, to, coerce: v => str(v, def) }),
  num:  (from, to, def=0)      => ({ from, to, coerce: v => num(v, def) }),
  emptyNull: (from, to)        => ({ from, to, coerce: emptyToNull }),
  enum: <S>(from, to, schema: S) => ({ from, to, coerce: v => schema.parse(v) }),
};
```

Esto permite que un schema completo se lea casi como tabla:

```ts
const embarqueSchema = {
  fields: [
    F.str("clienteId",            "cliente_id"),
    F.str("descripcionMercancia", "descripcion_mercancia"),
    F.num("pesoKg",               "peso_kg"),
    F.enum("modo", "modo", modoEmbarqueSchema),
    F.emptyNull("blMaster", "bl_master"),
    // ...
  ],
  computedToDb: (v, p) => ({ ...p, ...totalesDesdeContenedores(v) }),
};
```

### Seguridad runtime

- Integración opcional con Zod: si se pasa `rowSchema` y/o `formSchema` al crear el mapper, `toDb`/`fromDb` validan el resultado y lanzan `ZodError` con path exacto (mismo patrón que `fromDb` en `src/lib/supabase/cast.ts`).
- Sin Zod, el mapper es puro compile-time + coerciones manuales.

### Restricciones explícitas

- **NO** se usa `as unknown as` fuera de `genericPayloadMapper.ts`. Cualquier cast interno necesario para `set`/`get` por path queda confinado y marcado con `// SAFE-CAST:` (memoria del proyecto).
- Cumple Power of 10: archivo objetivo <200 líneas, sin `any`, funciones puras, sin efectos.

## Tests

`src/lib/mappers/__tests__/genericPayloadMapper.test.ts` cubre:

1. Round-trip simple (Form→Row→Form) con tipos primitivos.
2. Coerciones (`str`, `num`, `emptyToNull`).
3. Enums Zod (válido vs `ZodError` con path).
4. `direction: "toDb" | "fromDb"` aplicado correctamente.
5. `computedToDb` / `computedFromDb` se ejecutan después de los `fields`.
6. Compile-time guard: `// @ts-expect-error` en una ruta inexistente.

## Estructura del archivo

```text
genericPayloadMapper.ts
├─ types: DotPath, PathValue, FieldMap, MapperSchema
├─ internals: get(obj,path) / set(obj,path,val)  [SAFE-CAST aquí]
├─ F (DSL): str, num, emptyNull, enum, custom
├─ createPayloadMapper(schema): { toDb, fromDb }
└─ JSDoc con ejemplo embarque + cotización
```

## Fuera de alcance

- Migrar `embarqueToDb`/`embarqueFromDb` al nuevo mapper (PR separado, requiere re-correr suite de embarques completa).
- Soporte para arrays anidados con índices (`contenedores[*].peso_kg`). Se documenta como TODO; los casos actuales se resuelven con `computedToDb`.
- Cambios en `CHANGELOG.md` / `APP_VERSION` se harán al cierre del PR siguiendo la regla de memoria de changelog.

## Entregables

- `src/lib/mappers/genericPayloadMapper.ts` (<200 líneas).
- `src/lib/mappers/__tests__/genericPayloadMapper.test.ts`.
- Bump de versión y entrada en `CHANGELOG.md` describiendo la nueva utilidad (sin cambios de runtime para usuarios).
