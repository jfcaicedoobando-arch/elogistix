## Continuación auditoría CI — Fases pendientes

Quedan 2 fases del plan original más alto riesgo. Las divido en sub-pasos para implementación incremental y reversible.

### Fase 4 — Endurecimiento de Lint/Typecheck

**Riesgo alto**: probablemente generará decenas/cientos de errores. Se ejecuta por sub-pasos, midiendo el costo antes de comprometer.

**Paso 4.1 — Diagnóstico (read-only, sin commit)**
- Crear branch mental: ejecutar `bun run typecheck` con `strict: true` temporal y `bun run lint` con `import/no-cycle: error` + `exhaustive-deps: error` para medir el blast radius real.
- Generar reporte: cuántos archivos, qué categorías de error (implicit any, null checks, ciclos, deps faltantes).
- **Entrega**: un documento `reports/strict-mode-baseline.md` con conteos. Sin cambios en código.

**Paso 4.2 — Decisión informada**
- Con el reporte en mano, elegir una de tres rutas:
  - **A (incremental)**: activar sólo `noImplicitAny` + `strictNullChecks` y dejar el resto en falso. Migrar archivo por archivo.
  - **B (big bang)**: activar `strict: true` completo y arreglar todo en una PR larga.
  - **C (gating)**: dejar `strict: false` en `tsconfig.app.json` pero correr `tsc --strict --noEmit` en CI como step informacional (`continue-on-error: true`) para visibilidad sin bloqueo.
- Por defecto recomiendo **C** + **A** en paralelo (visibilidad sin romper, migración progresiva).

**Paso 4.3 — Activar `import/no-cycle` y `exhaustive-deps: error`**
- Si el reporte muestra <20 violaciones, se arreglan en la misma PR.
- Si son >20, se mantienen como `warn` y se añade un script `lint:cycles` informacional en CI.

### Fase 5 — Paralelismo de tests (`maxForks`)

**Riesgo medio**: react-pdf tiene fugas de memoria conocidas (existe el `pdfLeak` canary). Subir `maxForks` puede causar OOM en CI.

**Paso 5.1 — Medición empírica**
- Tomar el tiempo actual de la shard más lenta en CI (referencia para comparar).
- Identificar tests serial-only ya documentados (`pdfLeak`, `canaries`) para excluirlos del paralelismo.

**Paso 5.2 — Configuración conservadora**
- En `vitest.config.ts`: `maxForks: 2`, `fileParallelism: true`, `poolMatchGlobs` excluyendo `**/canaries/**` y `**/pdfLeak*` (esos siguen en pool aislado con `maxForks: 1`).
- Ejecutar localmente con `--reporter=verbose` y observar memoria con `/usr/bin/time -v` (heap peak).
- Si peak > 1.5 GB por worker → rollback a `maxForks: 1`.

**Paso 5.3 — Script `test:fast` para devs**
- Añadir `"test:fast": "vitest run --maxForks=4 --exclude '**/canaries/**' --exclude '**/pdfLeak*'"` en `package.json` para iteración local rápida (no CI).

### Versionado

- Fase 4.1 (reporte) → **12.97.2**
- Fase 4.2/4.3 (lint) → **12.97.3** o **12.98.0** según ruta elegida
- Fase 5 → **12.98.1**

### Estrategia de aprobación

Sugiero ejecutar **Paso 4.1 primero y solo** (es read-only, genera el reporte). Con esos datos a la vista, tú decides qué ruta tomar para 4.2/4.3 y si vale la pena Fase 5 ahora o postergarla.

¿Procedo con 4.1 (reporte de baseline strict mode) o prefieres saltar directo a Fase 5 (paralelismo de tests) que tiene menos blast radius?
