## Objetivo

Auditar **línea por línea** los archivos de test de los 12 shards del CI (`--shard=N/12`), **sin correr los tests**, para detectar bugs latentes, leaks, races, mocks colgados, asserts débiles, hygiene issues, etc. Cada shard lo audita 1 subagente independiente en paralelo.

## Por qué 1 agente por shard

- Cada shard tiene ~45 archivos de test → cabe holgadamente en el contexto de un subagente `capable`.
- Paralelismo total (12 a la vez) → tiempo de auditoría ≈ tiempo de 1 shard.
- Aísla hallazgos por shard, lo que facilita correlacionar con timeouts/coverage drops del CI.
- Cada subagente es read-only → cero riesgo de modificar código durante la auditoría.

## Paso 1 — Resolver la lista de archivos por shard

Vitest aplica `--shard=N/12` sobre la lista **ordenada** de test files que matchean el glob de `vitest.config.ts`. Antes de lanzar subagentes:

1. Leer `vitest.config.ts` para confirmar `include`/`exclude` y el modo de pool (`singleFork`).
2. Generar la lista completa de archivos `*.test.ts(x)` ordenada igual que Vitest.
3. Particionar en 12 grupos contiguos del mismo tamaño (lo que hace `--shard`).
4. Guardar la partición como referencia (no se escribe en el repo; se pasa inline a cada subagente).

## Paso 2 — Lanzar los 12 subagentes en paralelo

Una sola respuesta con 12 llamadas `spawn_agent` en paralelo, modelo `capable`. Cada uno recibe:

- **System prompt**: rol de auditor de tests Vitest + React Testing Library + mocks de Supabase, con foco en estabilidad bajo `singleFork`. Reglas del proyecto: cleanup obligatorio en `useEffect`-style mocks, `vi.stubGlobal` en vez de asignación directa, `await act(async () => …)` para updates async, `mockReset`/`clearAllMocks` en `beforeEach`, fake timers acotados con `beforeEach`/`afterEach`, asserts fuertes (no `toBeDefined` solo), sin `sleep` real, sin compartir `QueryClient` entre tests, etc.
- **Task**: lista exacta de archivos del shard N, instrucción de leerlos **uno por uno línea a línea** y producir un reporte estructurado con: archivo, líneas, severidad (CRÍTICA/ALTA/MEDIA/BAJA), patrón detectado, riesgo, fix propuesto, y si ya se aplicó en versiones recientes (referenciar memorias relevantes: `mem://technical/testing-cleanup-protocol`, `mem://technical/testing-mock-patterns`, `mem://features/testing-regression-canary`, `mem://technical/testing-strategy`).
- **Restricción explícita**: **NO ejecutar** `vitest`, `bun test`, ni ningún runner. Solo lectura.

## Paso 3 — Consolidación

Cuando lleguen las 12 notificaciones de completado:

1. Leer los 12 resultados con `get_agent_result`.
2. Consolidar en un único reporte agrupado por severidad y por shard, deduplicando patrones que aparezcan en múltiples shards (probablemente sean reglas a documentar en memoria).
3. Presentarte el reporte con: top hallazgos críticos, patrones recurrentes, propuesta de fixes priorizada, y candidatos a nueva memoria de testing.

## Paso 4 — (Opcional, requiere tu aprobación)

Después de revisar el reporte, podemos abrir un segundo plan para aplicar los fixes en lotes (por severidad o por shard) y bumpear versión.

## Detalles técnicos

- **Modelo de subagente**: `capable` para los 12 (lectura cuidadosa + razonamiento sobre concurrencia y leaks).
- **Costo aproximado**: 12 subagentes × ~45 archivos × lectura completa. Es significativo pero acotado y se ejecuta en paralelo.
- **No se modifica nada del repo en esta fase** — auditoría pura.
- **No se corre CI ni vitest local** — explícito en la instrucción de cada subagente.

## Lo que NO incluye este plan

- Aplicar fixes (lo proponemos como Paso 4 separado tras tu revisión).
- Bumpear versión / actualizar `CHANGELOG.md` (no hay cambios de código en esta fase).
- Cambiar configuración de CI o `vitest.config.ts`.
