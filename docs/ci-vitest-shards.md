# CI · Vitest: shards, workers y memoria

Última revisión: P1 auditoría stack Vite 6 / Vitest 4 / React Router 7.

## Topología actual

- Dos proyectos Vitest: `node` y `jsdom` (reparto en `scripts/lib/testEnvSplit.ts`).
- `pool: "forks"`, `isolate: true` (un fork por archivo).
- En Vitest 4 el pool se resuelve **por proyecto**, así que el pico de procesos
  puede acercarse a `2 × maxWorkers`.
- CI: ensayo vigente con `maxWorkers = 2`, heap
  `--max-old-space-size=8192`, 5 shards y `max-parallel = 5` (`ci.yml`, job
  `tests`). Runner `ubuntu-24.04`: 4 vCPU / 16 GB por shard.
- Local: `maxWorkers = min(8, cpus-2)`, heap 4096 MB. Override: `VITEST_FORKS`.

Justificación de `maxWorkers=2` en CI: con dos proyectos activos, 2 workers ya
pueden significar ~4 forks vivos; a 8 GB de heap cada uno, subirlos arriesga
OOM en un runner de 16 GB. Por eso el paralelismo en CI se consigue con
**shards** (procesos en runners distintos), no con más workers por runner.

## Cómo medir antes de cambiar algo

No se ajustan shards ni workers sin evidencia. Ejecutar:

```bash
# 1, 2 y 3 shards; registra duración, procesos y RSS pico
bash scripts/bench-vitest-shards.sh

# simular el paralelismo de CI
VITEST_FORKS=2 bash scripts/bench-vitest-shards.sh
```

Salida: tabla en consola y CSV en `/tmp/vitest-shard-bench.csv` con
`total_shards, shard, segundos, exit_code, max_procesos, max_rss_mb`.

Criterio de decisión:

- subir shards sólo si el tiempo de pared del shard más lento baja de forma
  consistente (≥ 15 %) en dos corridas;
- el pico de RSS por runner debe quedar por debajo de ~12 GB en un runner de
  16 GB;
- subir `maxWorkers` en CI requiere además comprobar el pico de procesos, no
  sólo el tiempo.

## Ensayo de 5 shards: medición real

Commit `954c29de09f96cf0317646899f575e83fbfa7693`.

| Corrida | Shards | Total (pared) | Vitest más lento |
| --- | --- | --- | --- |
| CI #4217 · run `35464373548` | 5 | 3 m 08 s | 2 m 38 s |
| CI #4213 · run `35462835847` | 3 | 4 m 13 s | 3 m 47 s |

Detalle de #4217: ESLint 2 m 41 s, checks 2 m 06 s, shards Vitest 1 m 39 s,
2 m 21 s, 2 m 28 s, 2 m 38 s, 2 m 09 s.

Lectura de los datos:

- La mejora de **tiempo de pared fue de 65 s (~26 %)** frente a 3 shards.
- El **nuevo cuello de botella es ESLint** (2 m 41 s), no Vitest: bajar más los
  shards ya casi no mueve el total del workflow.
- La **suma de tiempo de runners de los tests aumentó** (cinco runners con su
  propio checkout + install). Por lo tanto 5 shards es una decisión de
  **latencia vs consumo**, no una mejora gratuita.
- El reparto por archivos fue **331/331/331/330/330 sin solapamiento**, pero el
  **costo por archivo es desigual**: de ahí el rango 1 m 39 s – 2 m 38 s entre
  shards.

Conviene una **segunda corrida comparable** (mismo commit o diff equivalente,
misma detección de áreas) antes de fijar 5 shards como configuración
definitiva. Se mantienen `maxWorkers=2`, sin cobertura y sin blobs. No se
registran tiempos estimados o simulados como resultados reales.

## Caché de ESLint aislada: qué validar en la siguiente corrida

Commit `1b012c4f10457a29b40968d371dad4d50dea797a`: primera corrida con la caché
en `.cache/eslint` (fuera de `node_modules`). Fue **corrida fría**: el paso
mostró `Cache not found` y guardó la caché al final, así que **todavía no hay
medición de caché caliente**.

Baseline frío para comparar:

- job `ESLint` completo: **2 m 41 s**;
- comando `bun run lint`: **1 m 55 s**;
- total de pared del workflow: **3 m 08 s**; shard Vitest más lento **2 m 38 s**.

La siguiente corrida sobre el mismo `eslint.config.js` / `package.json` /
`bun.lock` debe verificarse en tres puntos:

1. el paso `Cache ESLint` registra `Cache restored successfully` o
   `Cache hit for restore-key` (nunca `Cache not found`);
2. la duración del comando ESLint baja respecto de **1 m 55 s** (job frío
   2 m 41 s); si no baja, la caché no se está reutilizando y hay que revisar la
   clave, no subir shards;
3. el **shard Vitest más lento** y el **tiempo total** se comparan contra
   **2 m 38 s** y **3 m 08 s**.

Hasta tener esos datos se conservan **5 shards** y **`maxWorkers=2`** sin
cambios, igual que la caché en `.cache/eslint` con `--cache-strategy content`.

## Limitación conocida


El sandbox de desarrollo tiene mucha más RAM/CPU que el runner de GitHub, así
que los tiempos locales **no** son extrapolables; sirven para comparar
configuraciones entre sí, no para predecir la duración en CI. La medición con
memoria real de CI requiere correr el script dentro de un runner
`ubuntu-24.04` vía `workflow_dispatch`.

## Historia de mediciones

- run `34196983386` — 1 job unificado: 15 m 44 s de espera, 922 s acumulados.
- run `34200102375` — 3 shards con lint dentro de `checks`: espera 347 s,
  ejecución acumulada 947 s; Vitest 1426 archivos / 8949 tests.
- run `35462835847` (CI #4213) — 3 shards, lint separado: 4 m 13 s de pared,
  shard Vitest más lento 3 m 47 s.
- run `35464373548` (CI #4217) — 5 shards, lint separado: 3 m 08 s de pared,
  shard Vitest más lento 2 m 38 s, ESLint 2 m 41 s (cuello de botella).
