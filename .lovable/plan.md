## Qué quedó pendiente del plan de tests

Cerramos QW1–QW5 (ratchet a 35% líneas / 50% funciones / 70% ramas en `13.85.7`) y QW3/QW4 en `13.85.8` (eran falsos positivos en su mayoría). **Falta:**

### QW6 — Tests unitarios para 3 hooks grandes con 0% cobertura
1. `src/features/proveedores/hooks/useNuevaFacturaProveedorForm.ts` (194 líneas)
2. `src/features/proveedores/hooks/useNuevoProveedorController.ts` (191 líneas)
3. `src/features/embarques/hooks/useNuevoEmbarqueWizard.ts` (187 líneas)

Para cada uno: `renderHook` + `createSupabaseMock` (canónico), cubrir defaults, validaciones, transiciones de estado, casos de error. Meta: ≥80% líneas por hook.

### B1 — Top archivos 0% de alto impacto (no orquestación)
Triage en este orden, parar cuando la cobertura llegue a 41% líneas:
- `useEmbarquesPageState.ts`
- `DialogRegistrarPagoProveedor.tsx` (lógica del form, no el JSX shell)
- `TrackingNuevoEventoForm.tsx`
- `HallazgosTabla.tsx`
- Siguientes según `coverage/coverage-summary.json` ordenado por LOC × (1 − coverage).

### B2 — Limpiar denominador de cobertura
Añadir a `coverage.exclude` en `vitest.config.ts`:
- `src/**/*Dialog.tsx` que sean shells presentacionales puros (lista a confirmar con grep)
- Layouts (`src/components/layout/**`)
Sin tocar exclusiones ya aplicadas.

### B3 — Ratchet final (solo si cobertura real ≥ umbral + 2)
Subir `vitest.config.ts` a `functions: 52, branches: 72` cuando QW6+B1+B2 dejen la cobertura con margen ≥ 2 puntos por métrica.

## Orden de ejecución y bumps

1. **QW6** (3 hooks, un commit por hook) → `13.85.9`
2. **B1** (archivos 0%, batch) + **B2** (exclusiones) → `13.85.10`
3. **B3** ratchet de `functions`/`branches` → `13.86.0`

## Verificación por paso

- `bunx vitest run` verde (≥ 3372 tests, sin baja).
- `bun run coverage` reporta líneas/funciones/ramas por encima del umbral nuevo.
- `bun run audit:tests` 0 violaciones.
- `CHANGELOG.md` actualizado en cada bump (formato `## [X.Y.Z] - YYYY-MM-DD`).

## Fuera de alcance

- No tocar `src/integrations/supabase/**`, `.env`, `supabase/config.toml`.
- No reescribir hooks productivos — solo testearlos.
- No cambiar copies ni i18n.
- Pages/routes JSX quedan excluidos (cubiertos por E2E).

## Próximo paso

Al aprobar, arranco con **QW6** (3 hooks en paralelo vía subagentes, un commit por hook).
