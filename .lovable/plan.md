## Problema

ESLint marca `classifyError` con complejidad ciclomática 18 (máx 16). Es una sola función con muchas ramas `if` para distintos tipos de error.

## Solución

Refactorizar extrayendo cada familia de detección a un helper pequeño. La función principal queda como una cadena corta de `return early`, bajando la complejidad a ~6.

## Cambios en `src/lib/observability/classifyError.ts`

Agregar helpers privados:

- `detectPgError(e): ClassifiedError | null` — bloque del SQLSTATE.
- `detectEdgeFunction(name): boolean`
- `detectAuth(e, name, status): boolean`
- `detectValidation(e, name): boolean`
- `detectNetwork(name, message): boolean`

Reescribir `classifyError` como:

```ts
export function classifyError(err: unknown): ClassifiedError {
  if (err == null) return { kind: "unknown" };
  const e = err as MaybePgError;
  const name = asString(e.name) ?? "";
  const message = asString(e.message) ?? "";
  const status = typeof e.status === "number" ? e.status : undefined;

  const pg = detectPgError(e);
  if (pg) return pg;
  if (detectEdgeFunction(name)) return { kind: "edge_function" };
  if (detectAuth(e, name, status)) return { kind: "auth" };
  if (detectValidation(e, name)) return { kind: "validation" };
  if (detectNetwork(name, message)) return { kind: "network" };
  return { kind: "unknown" };
}
```

Sin cambios de comportamiento; los 18 tests existentes siguen pasando. Bump de versión patch y entrada en `CHANGELOG.md`.

## Analogía

Es como una recepcionista que hacía 18 preguntas seguidas; ahora delega cada pregunta a un asistente especializado y sólo coordina el orden.
