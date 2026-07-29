## Diagnóstico (verificado leyendo la config y el sandbox)

El sandbox de Lovable **no** es el cuello de botella: tiene **16 vCPU y 125 GB de RAM**. El problema está en `vitest.config.ts`, que penaliza deliberadamente todo lo que no sea CI:

```ts
singleFork: !process.env.CI,        // local → 1 solo proceso
maxForks: process.env.CI ? 2 : 1,   // local → 1 fork
fileParallelism: !!process.env.CI,  // local → archivos en serie
```

Es decir: en GitHub Actions la suite corre en **10 shards × 2 forks = ~20 procesos en paralelo**, y en el sandbox corre en **1 solo proceso, un archivo a la vez**. Encima, `bun run test` en local es un `for i in 1..10` que ejecuta los 10 shards **secuencialmente** — o sea, arranca Vite 10 veces seguidas.

Analogía: en CI horneamos con 20 hornos a la vez; en el sandbox teníamos 16 hornos disponibles pero usábamos uno solo, y además metíamos las charolas de una en una.

El comentario que justifica `1 fork` habla de un riesgo de OOM con "8 GB heap"; ese cálculo se hizo pensando en un sandbox de 32 GB. Con 125 GB, 6–8 forks caben de sobra.

## Plan

### Paso 1 — Medición base (antes de tocar nada)
- Correr la suite completa con `--reporter=verbose --slowTestThreshold=1000`, guardando el output a `/tmp/vitest-baseline.txt`.
- Extraer el ranking de los 20 archivos más lentos y el wall-time total.
- Entregable: tabla "archivo → segundos" para saber si el problema es paralelismo, un puñado de archivos pesados, o ambos.

### Paso 2 — Habilitar paralelismo local en `vitest.config.ts`
- Calcular los forks a partir de los núcleos reales en vez del flag `CI`:
  - `fileParallelism: true` siempre.
  - `singleFork: false`.
  - `maxForks`: `CI ? 2 : min(8, nproc - 2)`; `minForks: 2`.
  - Bajar `execArgv` local a `--max-old-space-size=4096` (8 forks × 4 GB = 32 GB ≪ 125 GB, margen amplio y evita que V8 retrase el GC).
- Mantener `isolate: true` y `--expose-gc` para no romper las canarias de fugas de PDF.
- Dejar el comportamiento de CI **idéntico** al actual (los shards del workflow no cambian).

### Paso 3 — Arreglar el script `test` local
- `bun run test` deja de ser un bucle de 10 shards secuenciales y pasa a ser un `vitest run` único (que ya paraleliza internamente con el Paso 2). El modo shard queda disponible en `test:shard` para CI.

### Paso 4 — Re-medición y validación
- Volver a correr con `--reporter=verbose --slowTestThreshold=1000` y comparar wall-time contra la línea base.
- Verificar que **no** aparecen fallos nuevos por paralelismo (tests que dependían del orden serial: mocks globales, fechas, canarias de PDF). Si alguno falla, se marca ese archivo con `describe.sequential` o se aísla, en vez de revertir el paralelismo global.
- Si tras el cambio quedan archivos individuales >5 s, los reporto como candidatos a optimización específica.

### Paso 5 — Cierre
- Registrar el resultado (antes/después) en `CHANGELOG.md` y bump de `APP_VERSION`.

## Notas técnicas
- Riesgo principal: tests que hoy pasan sólo porque corren en serie (estado global compartido, `vi.setSystemTime`, la canaria de 200 renders de PDF). El Paso 4 existe justamente para detectarlos; se aíslan uno por uno, sin desactivar el paralelismo.
- No toco `vitest.fast.config.ts` (ya tenía 4 forks) más allá de dejar que herede la nueva base sin duplicar valores.
- No modifico umbrales de coverage ni el workflow de GitHub Actions.
