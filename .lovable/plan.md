## Objetivo
Medir cuánto tarda la suite completa de Vitest y ajustar `testTimeout`/`hookTimeout` en `vitest.config.ts` con un margen razonable.

## Pasos
1. Ejecutar `time bunx vitest run --reporter=default` (con `timeout: 600` en el sandbox) y capturar el tiempo total + tiempo del archivo/test más lento del output.
2. Si la corrida completa excede 600s del sandbox, fallback: correr por bloques (`src/features`, `src/hooks`, `src/pages`, `src/pdf`, `src/generators`, `src/contexts`, `src/__tests__`, `supabase`) sumando tiempos.
3. Calcular timeout por test = (max test individual observado) × 2, redondeado al alza (mínimo 10s, máximo 60s). Calcular hookTimeout igual.
4. Actualizar `vitest.config.ts` con los valores calculados (reemplazando los 60_000 actuales).
5. Bump `APP_VERSION` a `12.60.3` y agregar entrada en `CHANGELOG.md` con los números medidos.

## Entregable
Reporte breve en el chat con: tiempo total, test más lento, valores elegidos y por qué.