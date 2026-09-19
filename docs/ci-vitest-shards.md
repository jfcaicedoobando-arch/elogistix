# CI · Vitest: shards, workers y memoria

Última revisión: P1 auditoría stack Vite 6 / Vitest 4 / React Router 7.

## Topología actual

- Dos proyectos Vitest: `node` y `jsdom` (reparto en `scripts/lib/testEnvSplit.ts`).
- `pool: "forks"`, `isolate: true` (un fork por archivo).
- En Vitest 4 el pool se resuelve **por proyecto**, así que el pico de procesos
  puede acercarse a `2 × maxWorkers`.
- CI: `maxWorkers = 2`, heap `--max-old-space-size=8192`, 3 shards
  (`ci.yml`, job `tests`). Runner `ubuntu-24.04`: 4 vCPU / 16 GB.
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
- Configuración vigente (lint separado de checks, Vitest 4): **sin medición
  nueva**. Cualquier cambio de shards/workers debe adjuntar la salida del
  script de arriba.
