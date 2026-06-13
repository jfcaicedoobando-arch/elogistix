# Plan: Mejora de CI y Salud de la App

Auditoría realizada por 4 sub-agentes en paralelo: **workflows CI**, **suite de tests**, **lint/typecheck**, **build/bundle**. Versión base: `12.96.7`.

---

## Resumen de hallazgos

| Severidad | Cantidad | Áreas |
|-----------|----------|-------|
| Crítico   | 1 | Versiones de GitHub Actions inexistentes (CI roto) |
| Alto      | 3 | TS no strict, falta `permissions`, sharding falso |
| Medio     | 6 | Lazy de libs pesadas, sin budget de bundle, sin cycle detection, exhaustive-deps en warn, cache Deno, manualChunks |
| Bajo      | 4 | Bun `latest` en e2e, umbrales coverage 30%, secrets guard, chunkSize 500kB |

---

## Fase 1 — Hotfix CI (Crítico, ~10 min)

**Problema:** `ci.yml` usa `actions/checkout@v6`, `upload-artifact@v6`, `download-artifact@v7` — versiones inexistentes. CI debe estar fallando en cada push.

**Cambios:**
- `ci.yml:20,74,203` → degradar a `@v4` (versión estable actual).
- Añadir bloque `permissions: contents: read` a nivel workflow.
- `e2e.yml:49` → fijar `bun-version: 1.x` (consistente con `ci.yml`).
- `ci.yml:104` → incluir `deno.json`/`deno.lock` en key de cache de Deno.

**Bump:** `12.96.8` + entrada en `CHANGELOG.md`.

---

## Fase 2 — Performance de bundle (Alto, ~45 min)

**Problema:** `xlsx` y `@react-pdf/renderer` se importan estáticamente; el preload en `AuthContext` arrastra >1MB al login.

**Cambios:**
- `src/lib/import/bbva.ts` y otros parsers: `await import("xlsx")` dentro de la función `parseEstadoCuentaBBVA`.
- `src/pdf/render/descargarPdf.ts` y `src/generators/*`: dynamic import de `@react-pdf/renderer` dentro de `descargarPdf` / generadores.
- `vite.config.ts`: `chunkSizeWarningLimit: 350`.
- `package.json`: mover `rollup-plugin-visualizer` a `devDependencies`.
- Verificar manualmente que el preload de `AuthContext` no descargue las libs pesadas.

**Bump:** `12.96.9`.

---

## Fase 3 — Gates de calidad en CI (Alto, ~30 min)

**Problema:** Build pasa sin verificar tamaño; coverage merge no falla por umbral.

**Cambios en `.github/workflows/ci.yml`:**
- Nuevo step tras `build`: check de tamaño de `dist/assets/index-*.js` (script bash simple, fail si >X KB gzipped).
- Subir `dist/stats.html` como artifact cuando `ANALYZE=true`.
- Integrar `scripts/audit-casts.ts` en `ga-gate.sh` con fail si hay nuevos `CRITICAL`.

**Bump:** `12.97.0` (minor por nuevos gates).

---

## Fase 4 — Endurecer lint/typecheck (Alto, ~60 min + fix de errores)

**Problema:** `tsconfig.app.json` con `strict: false`; sin detección de ciclos; `exhaustive-deps` en `warn`.

**Cambios:**
- `tsconfig.app.json`: `strict: true` (activa `strictPropertyInitialization`, `strictFunctionTypes`, `noImplicitThis`, etc.). **Riesgo:** generará errores nuevos; corregirlos como sub-tarea iterativa.
- `eslint.config.js`: añadir `eslint-plugin-import` con `import/no-cycle: error`.
- Elevar `react-hooks/exhaustive-deps` a `error`.
- Elevar exports no usados de knip a `error` (ya está en `warn`).

**Estrategia:** ejecutar typecheck local primero para dimensionar el blast radius. Si son <30 errores, corregir en la misma fase; si son más, hacer fase 4b separada.

**Bump:** `12.97.1`.

---

## Fase 5 — Velocidad real de tests (Medio, ~30 min)

**Problema:** `package.json:test` corre 16 shards en bucle `for` secuencial (sin ganancia wall-clock). `maxForks: 1` en vitest. Cobertura global 30%.

**Cambios:**
- `vitest.config.ts`: probar `maxForks: 2`, `fileParallelism: true` excluyendo `pdfLeak.test.tsx` y `canaries/*` (mantener serial sólo donde haya riesgo de OOM).
- `package.json`: script `test:fast` para devs (sin sharding), mantener `test:shard` para CI.
- CI ya paraleliza shards via matrix → OK. Documentar que el script local es informativo.
- Subir umbrales `lines/statements` de 30 → 40% en `vitest.config.ts`.

**Bump:** `12.97.2`.

---

## Fase 6 — Pulido (Bajo, ~15 min)

- Guard `if: ${{ secrets.DEMO_USER_EMAIL != '' }}` a nivel de job en `post-deploy-smoke.yml`.
- Documentar en `docs/` la estrategia de sharding y los nuevos gates.

**Bump:** `12.97.3`.

---

## Detalles técnicos

```text
┌─────────────────────────────────────────────────────┐
│ Pipeline CI objetivo (post-mejoras)                 │
├─────────────────────────────────────────────────────┤
│ 1. Setup (cache bun + deno)                         │
│ 2. Lint + Typecheck (strict) + Knip (error)         │
│ 3. Audit-architecture + Audit-casts (gate CRITICAL) │
│ 4. Deno tests (Edge Functions)                      │
│ 5. Vitest matrix [1..16] (fail-fast: false)         │
│ 6. Coverage merge + threshold gate (40%)            │
│ 7. Build + bundle-size gate + visualizer artifact   │
└─────────────────────────────────────────────────────┘
```

## Fuera de alcance

- Migración a otro test runner.
- Lighthouse CI completo (sólo gate de tamaño en esta iteración).
- Refactor de tests existentes para subir coverage por feature (se documenta sólo el umbral global).
- Cambios funcionales en la app.

## Reglas transversales

- Cada fase: bump `APP_VERSION` + entrada en `CHANGELOG.md` con formato `## [X.Y.Z] - YYYY-MM-DD`.
- Cero cambios funcionales en UI/negocio.
- Si una fase rompe CI, revertir esa fase aislada (no bloquear las siguientes).
- Tras Fase 1, validar que CI verde antes de continuar con Fase 2+.

## Orden sugerido de ejecución

1. **Fase 1 ya** (CI está roto).
2. Fases 2, 3, 5 en paralelo (independientes).
3. Fase 4 al final (riesgo de blast radius en types).
4. Fase 6 como cleanup.
