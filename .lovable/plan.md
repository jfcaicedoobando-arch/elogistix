## Objetivo

Confirmar que tras el teardown global de 12.60.20 la suite completa de Vitest corre verde en un solo `vitest run`, sin OOM ni fugas acumulativas.

## Pasos

1. **Ejecutar suite completa con heap logging:**
   ```bash
   timeout 580 npx vitest run --logHeapUsage 2>&1 | tee /tmp/vitest-full.log | tail -120
   ```
2. **Extraer métricas clave** del log:
   - Total de archivos y tests (`Test Files` / `Tests`).
   - Picos de heap (`heap used`).
   - Fallos (`FAIL`, `failed`, `OOM`, `heap limit`, `ERR_IPC_CHANNEL_CLOSED`).
3. **Interpretación:**
   - ✅ Verde end-to-end → confirmar conteos y heap pico estable.
   - ⏱ Exit 124 (timeout shell) sin OOM → no es fuga, sólo duración; reportar y sugerir mantener shards en CI.
   - ❌ OOM / heap limit → la fuga sigue viva; capturar último archivo procesado para diagnóstico.
   - ❌ Assertions failing → listar archivos y mensajes.
4. **Versionado (sólo si verde o timeout sin OOM):**
   - Bump `APP_VERSION` → `12.60.21` en `src/constants/appVersion.ts`.
   - Entrada en `CHANGELOG.md`: validación de suite completa en una corrida, heap pico observado, sin regresiones.
5. **Sin cambios de código de producción ni de `vitest.config.ts`.** No se vuelve a correr por shards.

## Riesgos

- El sandbox tiene timeout máximo de 600s; si la suite se acerca, sólo capturamos el final del log. No es fuga, sólo límite del entorno.
- Si aparece OOM nuevo, no se hace bump y se reporta para definir próximo paso (no incluido en este plan).
