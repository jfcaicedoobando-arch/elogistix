# Plan: Tratar errores esperados del buzón como avisos amables

## Contexto
`BuzonDuplicadoError` (`src/features/cxp/services/facturasEntrantesDedupe.ts`) ya tiene `expected = true` y Sentry ya lo filtra (`dropFiltersNegocio.ts` línea 99). Sin embargo `notifyError` (`src/lib/ui/appFeedback.ts`) lo trata como falla grave: muestra el toast con "Ver detalles" / `ErrorDetailsDialog` y llama `reportCaughtError`, generando reportes de error confusos para el usuario.

## Cambios

1. **`src/lib/ui/appFeedback.ts`**
   - Detectar errores con propiedad `expected === true` (o `instanceof BuzonDuplicadoError` no — mejor genérico por propiedad).
   - Para esos errores: mostrar toast de tipo **warning/info** con el `error.message` como descripción, **sin** acción "Ver detalles", **sin** `reportCaughtError` ni `requestId`.

2. **`src/lib/observability/reportCaughtError.ts`** (verificación)
   - Confirmar que también omite errores `expected === true` como defensa en profundidad (por si otra ruta lo llama directo).

3. **Tests**
   - Caso en tests de `appFeedback` (o donde exista): un error con `expected: true` produce toast sin detalles y no invoca `reportCaughtError`.
   - Verificar que los tests existentes de `facturasEntrantesDedupe` siguen pasando.

4. **Versionado y bitácora**
   - Bump `APP_VERSION` (patch) y entrada en `CHANGELOG.md`.

## Detalles técnicos
- No se cambia la lógica de dedupe ni los mensajes: solo la presentación.
- La detección genérica por `expected === true` beneficia a cualquier otro error esperado futuro (no solo el buzón).

## Verificación
- `bunx vitest run` en los tests afectados.
- Revisar `/tmp/observability/build-errors.log`.
