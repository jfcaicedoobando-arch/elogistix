
# Bloque D15 — Reporte CI de violaciones (v11.62.0)

## Objetivo

Generar un **reporte único consolidado** (Markdown + JSON) que el CI publique en cada PR/push, agregando violaciones de capa, archivos oversized, casts HIGH/CRITICAL y tests skipeados. Hoy estas señales existen sueltas (`audit:arch`, `audit:casts`, `audit:tests`) pero no se publican como artefacto ni se resumen en un único lugar.

## Alcance

1. Nuevo script `scripts/audit-report.ts` que:
   - Reutiliza la lógica de `audit-architecture.ts` (imports directos a `@/integrations/supabase/client` en hooks/contexts/components/pages + oversized >200 líneas).
   - Reutiliza la lógica de `audit-casts.ts` (cuenta HIGH + CRITICAL y top-10 archivos por peso).
   - Reutiliza la lógica de `audit-tests.ts` (skip/only/todo sin issue, títulos duplicados).
   - Refactor mínimo: extraer las funciones `walk`, `findDirectClientImports`, `findOversized`, `scan` (casts) y `audit` (tests) a módulos puros bajo `scripts/lib/` para que sean importables sin ejecutar side-effects. Los 3 scripts existentes siguen funcionando como CLIs (delgados, < 50 líneas cada uno).
   - Escribe dos artefactos en `reports/`:
     - `reports/audit-report.md` — resumen humano (tablas + top issues).
     - `reports/audit-report.json` — máquina-legible: `{ arch: {...}, casts: {...}, tests: {...}, generatedAt, version }`.
   - Exit code 0 siempre (es informativo; los gates duros viven en `architecture-baseline.test.ts` y `audit:tests`).

2. Nuevo script auxiliar `scripts/audit-summary.ts` que imprime el resumen en consola para usarlo como step de CI legible.

3. Tests:
   - `scripts/__tests__/audit-report.test.ts` que ejecuta el reporte contra `src/` y valida shape JSON, conteos básicos (hooksContextsDirectImports === 0, oversized === 0, sin tests skipeados) y que ambos archivos se generan.

4. `package.json`:
   - Añadir `"audit:report": "tsx scripts/audit-report.ts"`.
   - Añadir `"audit:all": "bun run audit:arch && bun run audit:casts && bun run audit:tests && bun run audit:report"`.

5. `.github/workflows/ci.yml`:
   - Nuevo step **"Architecture & cast report"** después de Tests, ejecuta `bun run audit:report`.
   - Step **"Upload audit report"** con `actions/upload-artifact@v4` subiendo `reports/audit-report.md` y `reports/audit-report.json` (retención 30 días).
   - Step **"PR summary"** sólo en `pull_request`: appendea `reports/audit-report.md` a `$GITHUB_STEP_SUMMARY` para que aparezca en la pestaña Summary del run.

6. `.gitignore`: añadir `reports/` (artefactos generados, no versionados).

7. Docs:
   - `CHANGELOG.md` → entrada `[11.62.0]` con bullet del nuevo reporte CI.
   - `src/constants/appVersion.ts` → `11.62.0`.
   - `.lovable/plan.md` → marcar **D15 ✅ CERRADO** y dejar pendientes D12, D14 (guardrail), D16.
   - `docs/auditoria.md` → sección nueva "Reporte CI automático" explicando dónde descargar el artefacto y qué contiene.

## Detalles técnicos

- Estructura `scripts/lib/`:
  ```
  scripts/lib/walk.ts            // walk() compartido
  scripts/lib/arch.ts            // findDirectClientImports + findOversized
  scripts/lib/casts.ts           // scan() + classify*
  scripts/lib/tests.ts           // audit() de tests
  ```
- Los 3 scripts CLI existentes pasan a importar de `./lib/*` (cambio interno, salida idéntica).
- Cada módulo < 200 líneas; el script orquestador `audit-report.ts` < 150 líneas.
- Schema JSON del reporte:
  ```json
  {
    "version": "11.62.0",
    "generatedAt": "2026-05-27T...",
    "arch": {
      "hooksContextsDirectImports": [],
      "componentsPagesDirectImports": [],
      "oversized": [{ "file": "...", "lines": 0 }]
    },
    "casts": {
      "total": 720,
      "bySeverity": { "SAFE": 0, "LOW": 0, "MEDIUM": 0, "HIGH": 37, "CRITICAL": 0 },
      "topFiles": [{ "file": "...", "weight": 0, "total": 0 }]
    },
    "tests": {
      "violations": []
    }
  }
  ```

## Out of scope

- No se reduce el conteo de casts HIGH (eso es D16).
- No se parte `routes.tsx` (D12).
- No se añade la aserción `archivosProductivosOver200 === 0` al test de arquitectura (D14 — separado, breve).
- No se publica en PR como comment-bot (sólo `$GITHUB_STEP_SUMMARY` y artifact); abrir bot/Octokit es overhead innecesario.

## Validación

- `bun run audit:report` localmente produce `reports/audit-report.md` y `.json` con los conteos esperados (0 violations de capa, 0 oversized, ~37 HIGH casts, 0 test hygiene issues).
- `bun run test` sigue verde (728 + 1 nuevo).
- Lint clean en `scripts/`.

## Versión / changelog

- `APP_VERSION = "11.62.0"`.
- `CHANGELOG.md` entrada nueva.
- `.lovable/plan.md` actualizado.
