## Contexto

La suite principal de pruebas excluye intencionalmente los archivos `*.perf.test.tsx` y `*.perf.ts` del `vitest.config.ts` (configurado en el campo `test.exclude`). Estos tests de benchmark consumen mucha memoria y enmascaran timeouts, por lo que solo deben ejecutarse bajo demanda.

## Objetivo

Agregar un script `test:perf` en `package.json` que ejecute de manera explícita solo los archivos de benchmark, usando una configuración de Vitest dedicada que no los excluya.

## Cambios propuestos

### 1. Crear `vitest.perf.config.ts`

Archivo de configuración dedicado que hereda la base de `vitest.config.ts` pero anula `include`/`exclude` para apuntar únicamente a tests de rendimiento.

```ts
import { defineConfig, mergeConfig } from "vitest/config";
import baseConfig from "./vitest.config";

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      // Solo archivos de performance
      include: ["src/**/*.perf.test.tsx", "src/**/*.perf.ts"],
      // Excluir defaults de Vitest, pero NO excluir los perf
      exclude: ["node_modules/**", "dist/**"],
    },
  })
);
```

### 2. Modificar `package.json`

Agregar el script `test:perf` bajo la sección `scripts`:

```json
"test:perf": "vitest run --config vitest.perf.config.ts"
```

### 3. Actualizar version y changelog

- Bump `APP_VERSION` a `12.60.7`
- Registrar entrada en `CHANGELOG.md` (root) describiendo el nuevo script y la config dedicada

## Notas técnicas

- `mergeConfig` de Vitest (re-exportado de Vite) combina la configuración base (plugins, alias, pool forks, etc.) con los overrides de inclusión/exclusión de archivos.
- El pool `forks` con `isolate: true` y `--max-old-space-size=8192` se mantiene, garantizando aislamiento completo entre archivos de benchmark.
- Este cambio NO afecta la suite principal (`npm test`, `test:coverage`, etc.).