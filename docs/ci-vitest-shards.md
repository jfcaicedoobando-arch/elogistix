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

### Primera corrida caliente (caché de ESLint activa)

Commit `9de2325b6a8d276cd84ce8c4d3d19bb80e6f6e51` · CI #4219 · run `35466468012`.

| Corrida | Shards | Total (pared) | Vitest más lento | ESLint (comando) |
| --- | --- | --- | --- | --- |
| CI #4219 · run `35466468012` | 5 | 3 m 26 s | ~2 m 27 s (shard 4/5) | ~7.5 s |
| CI #4217 · run `35464373548` | 5 | 3 m 08 s | 2 m 38 s | 1 m 55 s |
| CI #4213 · run `35462835847` | 3 | 4 m 13 s | 3 m 47 s | — |

Detalle de #4219:

- Gitleaks #2620: success.
- Checks (typecheck/build/gates): success.
- `bun run lint`: ~7.5 s; el job `ESLint` completo duró ~16 s. La caché se
  restauró por `Cache hit for restore-key`, sin `Cache not found`.
- Vitest shards:
  - 1/5: 95.69 s
  - 2/5: 128.60 s
  - 3/5: 129.73 s
  - 4/5: 146.73 s (más lento)
  - 5/5: 144.73 s

Lectura de los datos:

- **La caché aislada de ESLint funciona**: el comando pasó de 1 m 55 s a ~7.5 s
  y el job de ~2 m 41 s a ~16 s. ESLint **ya no es el cuello de botella**.
- El **tiempo total de pared (3 m 26 s) no debe compararse como regresión
  directa** contra los 3 m 08 s de la corrida anterior: la variación entre runners
  de GitHub Actions puede mover varias decenas de segundos. La comparación
  útil sigue siendo contra la corrida de 3 shards (4 m 13 s) y contra el shard
  más lento.
- Se conservan **5 shards** y **`maxWorkers=2`**. No hay evidencia todavía de
  que subir más shards reduzca el tiempo de pared de forma sostenida.
- **Nuevo foco de observación**: los shards 4/5 y 5/5 fueron los más lentos
  (~2 m 27 s), y también el job `checks` acumula typecheck + build + gates. Antes
  de proponer un re-balanceo automático se necesita una segunda corrida
  comparable que confirme esa asimetría.
- La **suma de tiempo de runners de los tests aumentó** (cinco runners con su
  propio checkout + install). Por lo tanto 5 shards es una decisión de
  **latencia vs consumo**, no una mejora gratuita.

### Corridas previas

| Corrida | Shards | Total (pared) | Vitest más lento |
| --- | --- | --- | --- |
| CI #4217 · run `35464373548` | 5 | 3 m 08 s | 2 m 38 s |
| CI #4213 · run `35462835847` | 3 | 4 m 13 s | 3 m 47 s |

Detalle de #4217: ESLint 2 m 41 s, checks 2 m 06 s, shards Vitest 1 m 39 s,
2 m 21 s, 2 m 28 s, 2 m 38 s, 2 m 09 s.

Lectura histórica:

- La mejora de **tiempo de pared fue de 65 s (~26 %)** frente a 3 shards.
- El reparto por archivos fue **331/331/331/330/330 sin solapamiento**, pero el
  **costo por archivo es desigual**: de ahí el rango 1 m 39 s – 2 m 38 s entre
  shards.

Conviene una **segunda corrida comparable** (mismo commit o diff equivalente,
misma detección de áreas) antes de fijar 5 shards como configuración
definitiva. No se registran tiempos estimados o simulados como resultados reales.

## Caché de ESLint aislada: validación caliente

Commit `9de2325b6a8d276cd84ce8c4d3d19bb80e6f6e51` · CI #4219 · run
`35466468012`: primera corrida con la caché en `.cache/eslint` fuera de
`node_modules` y **caché caliente**. El paso `Cache ESLint` registró un hit por
`Cache hit for restore-key` (equivalente a `Cache restored successfully`); no
apareció `Cache not found`.

Comparativa fría vs caliente:

| Métrica | Corrida fría (#4217) | Corrida caliente (#4219) |
| --- | --- | --- |
| job `ESLint` completo | **2 m 41 s** | ~16 s |
| `bun run lint` | **1 m 55 s** | ~7.5 s |
| total de pared | **3 m 08 s** | 3 m 26 s |
| shard Vitest más lento | **2 m 38 s** | ~2 m 27 s |

Validación cumplida:

1. `Cache ESLint` restauró vía `Cache hit for restore-key` o
   `Cache restored successfully`, sin `Cache not found`.
2. La duración del comando ESLint bajó de **1 m 55 s** a ~7.5 s.
3. El shard Vitest más lento y el tiempo total se midieron; el total varió
   dentro del rango esperado por diferencias de runner.

Se conservan **5 shards** y **`maxWorkers=2`** sin cambios, igual que la caché en
`.cache/eslint` con `--cache-strategy content`.

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
