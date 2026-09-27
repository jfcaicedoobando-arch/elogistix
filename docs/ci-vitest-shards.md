# Vitest: shards, workers y mediciones

Configuración revisada el **2026-09-26**: Vite 8 / Vitest 5 / Router 7.
Fuente: `ci.yml`, `vitest.config.ts`, `vitest.shared.ts`.

## Configuración vigente

- Cinco shards, `max-parallel: 5`, sin coverage/retry/blobs en CI principal.
- Proyectos node/jsdom con `extends: false` y opciones explícitas.
- `pool: forks`, aislamiento por archivo; límite `MAX_WORKERS=2` en CI.
- Heap de workers: 8192 MB CI, 4096 MB local; no es reserva de RAM.
- Local: mínimo 2, máximo 8 según CPU; override `VITEST_FORKS`.
- Aliases ESM Router y stub PDF centralizados en `aliasVitest()`.
- `clearMocks: false` explícito conserva la semántica de mocks de esta suite.

No deducir “cuatro forks activos” ni RSS multiplicando proyectos por workers:
la concurrencia efectiva se mide. Cinco runners reducen latencia pero pueden
aumentar minutos totales facturados.

## Medir antes de ajustar

`scripts/bench-vitest-shards.sh` conserva un ensayo local de 1/2/3 shards.
Consultar parámetros y límites del script antes de usarlo para otro escenario.
La comparación de cinco shards se obtiene del run real de Actions.

Comparar mismo SHA/áreas, cache fría/caliente, duración de cada shard,
wall-clock, instalación, lint y RSS pico. Un sandbox local no predice tiempos
del runner ni una cifra de memoria del proveedor.

## Mediciones históricas

Los registros siguientes son evidencia anterior a este repaso.
No son SLA ni benchmark repetido del stack Vite 8/Vitest 5.
No se ejecutó suite completa ni ensayo de rendimiento durante esta limpieza.



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

Para un ajuste futuro conviene una segunda corrida comparable, con mismo SHA
/ áreas detectadas. No se registran tiempos estimados o simulados como resultados reales.
