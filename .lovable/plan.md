## Objetivo

Mitigar fugas de memoria y timeouts al ejecutar la suite agregando dos cambios puntuales a `vitest.config.ts`:

1. Excluir los tests de performance del run regular.
2. Garantizar limpieza total de JSDOM entre archivos vía aislamiento por fork.

## Cambios en `vitest.config.ts`

Dentro del objeto `test`:

**A. Agregar `exclude` con los patrones perf** (no existe hoy, solo `include`):

```ts
exclude: [
  "node_modules/**",
  "dist/**",
  "src/**/*.perf.test.tsx",
  "src/**/*.perf.ts",
],
```

Se incluyen `node_modules/**` y `dist/**` para conservar los defaults de Vitest que se pierden al declarar `exclude` explícitamente.

**B. Añadir `isolate: true` dentro de `poolOptions.forks`** (ya existe `isolate: true` a nivel `test`, pero el usuario pide reforzarlo a nivel pool para asegurar que cada archivo corra en un fork limpio):

```ts
poolOptions: {
  forks: {
    singleFork: false,
    maxForks: 2,
    minForks: 1,
    isolate: true,
    execArgv: ["--max-old-space-size=8192"],
  },
},
```

`pool: "forks"` ya está configurado, no se toca.

## Verificación post-implementación

- Ejecutar `bunx vitest run --shard=3/4` y confirmar que ya no aparece OOM.
- Confirmar que ningún archivo `*.perf.test.tsx` / `*.perf.ts` se ejecuta en la corrida normal (el conteo de test files debe bajar si existen).

## Changelog

Bump `APP_VERSION` a `12.60.6` y entrada nueva en `CHANGELOG.md` describiendo el exclude de perf tests y el `isolate` por fork.
