# Plan: auditoría exhaustiva del shard 2/12

## Contexto

Los fixes de `13.137.24` cubrieron 8 archivos sospechosos en shards 2 y 6, pero el CI sigue colgándose >20 min. La auditoría previa fue **heurística** (grep de patrones conocidos: `waitFor` sin timeout, `act` sin `await`, etc.). Esta vez vamos **línea por línea** sobre los 46 archivos del shard 2, sin filtrar por patrón.

## Analogía

La auditoría anterior fue como buscar las llaves debajo del farol porque ahí hay luz. Ahora vamos a barrer toda la habitación con lámpara en mano: cada test del shard 2 se lee completo, no sólo los que coinciden con sospechas previas.

## Cómo se reparte el trabajo

1. **Resolver la lista exacta del shard 2/12** ejecutando localmente `vitest list --shard=2/12` para obtener los 46 paths actuales (la lista puede haber cambiado tras los fixes de `13.137.24`).

2. **Dividir en 4 lotes de ~12 archivos** y lanzar **4 subagentes en paralelo** (`acp_subagent--spawn_agent`, modelo `capable`). Cada uno recibe:
   - Lista exacta de archivos a leer.
   - Instrucción de leer **el archivo completo** y reportar por archivo:
     - Timers reales (`sleep`, `setTimeout` sin fake timers) con duración estimada.
     - `waitFor` / `findBy*` sin timeout custom y con condición costosa.
     - Mocks de Supabase / fetch sin todos los métodos encadenables.
     - Promesas creadas en el test que nunca se resuelven (sin `.resolves`/`.rejects`).
     - `renderHook` / `render` sin `unmount` al final, especialmente con suscripciones realtime o `onAuthStateChange`.
     - QueryClient o wrappers compartidos a nivel módulo.
     - Loops `for`/`while` que generan trabajo pesado sin yield (PDF, parsers, fixtures grandes).
     - `vi.useFakeTimers` sin `vi.useRealTimers` en cleanup.
     - `act` sin `await`.
     - Cualquier `import` que dispare side effects pesados al cargar (PDF font loaders, Sentry init).
   - Para cada hallazgo: ruta, líneas, severidad (alta/media/baja), justificación de por qué podría colgar o ralentizar el shard.

3. **Consolidar hallazgos** en un solo plan de fixes con orden por severidad. Si aparece evidencia clara del culpable del timeout (ej. un test que carga `react-pdf` sin stub, o suscripción realtime sin unmount), priorizar ese fix primero y validar localmente con `vitest run --shard=2/12` cronometrado.

4. **Aplicar fixes** sólo después de tener el reporte consolidado, no en streaming, para evitar tocar archivos que otros subagentes están leyendo.

## Entregables

- Reporte consolidado en `.lovable/plan-shard2-audit.md` con tabla de 46 archivos × estado (clean / sospechoso / culpable probable).
- PR de fixes con bump `13.137.25` y entrada en `CHANGELOG.md`.
- Si el shard 2 vuelve a colgar tras los fixes, abrir follow-up con instrumentación (`VITEST_POOL_LOGS=1`, `--reporter=verbose`) para capturar qué test es el último en empezar antes del timeout.

## Fuera de alcance

- Shards distintos al 2/12.
- Cambios al workflow CI (ya endurecido en `13.137.23`).
- Refactor de tests sin bug detectado, sólo por estilo.
