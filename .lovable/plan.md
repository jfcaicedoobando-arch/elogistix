# Plan: Cerrar pendientes reales de auditoría (12.x)

Base: `mem://audit/pendings` actualizado 2026-05-28. Solo se atacan ítems vivos. Cada fase = versión menor, con bump `APP_VERSION` + bloque `CHANGELOG.md` y `bun run audit:arch` verde.

---

## Fase 1 — Regresiones Power of 10 (12.1.0)
Riesgo bajo. Split de los 4 archivos >200 líneas introducidos en esta sesión + excepción documentada.

- **rc.1** `SeccionDestinatario.tsx` (321) → extraer `useSeccionDestinatario` + subcomponentes (`DestinatarioContactoFields`, `DestinatarioDireccionFields`, `DestinatarioFiscalFields`).
- **rc.2** `DialogDuplicarEmbarque.tsx` (265) → `useDuplicarEmbarque` (lógica de duplicación) + `DuplicarEmbarqueForm` (UI).
- **rc.3** `useCotizacionWizardSteps.ts` (212) → dividir en `wizardSteps/{definitions,validators,navigation}.ts` + barrel.
- **rc.4** `services/embarque/vincularCotizacion.ts` (202) → `vincularCotizacion/{mapper,validator,mutator}.ts` + barrel preservando API.
- **B7** Documentar excepción `components/ui/sidebar.tsx` (shadcn base) en `docs/power10-baseline.md`.
- **Excepción** `src/pdf/theme/styles.ts` (278) queda registrada como exenta (react-pdf StyleSheet) en `power10-baseline.md`; no se toca.

## Fase 2 — Cosmético / convenciones (12.2.0)
- **C10** Auditar las 64 ocurrencias de `style={{…}}`. Reemplazar por clases Tailwind/tokens donde aplique; marcar el resto con `// SAFE-CAST:` y razón válida según `mem://principles/inline-styles` (react-pdf, virtualizer, % dinámico, color desde DB). Objetivo: 0 inline no justificados.
- **C11** Homogeneizar prefijos en `pages/admin-org/`: renombrar `Configuracion.tsx` → `TabConfiguracion.tsx` (convención dominante `Tab*` en el módulo) y actualizar imports.

## Fase 3 — Zod en boundary Supabase (12.3.0)
- **P1.7** Crear schemas zod en `lib/schemas/` para:
  - `embarqueRowSchema` (extender el existente de queries a row completa).
  - `facturaRowSchema`, `cotizacionRowSchema`.
- Reemplazar `fromDb<T>()` por `fromDb(data, schema)` en `services/{embarque,facturas,cotizacion}/queries/*`.
- Errores de parseo → `console.error` con path del campo + fallback seguro (no romper UI).
- Tests por schema con fixture real.

## Fase 4 — Bajar complejidad ciclomática (12.4.0)
- **Refactor complexity** Las funciones en `src/` con complejidad 13–16:
  - Extraer guards tempranos y ramas a helpers en `lib/`.
  - Una vez todas ≤12, bajar guardrail ESLint `complexity: ["error", 12]`.
- Edge functions ya están <200 líneas y <15 complexity → no se tocan (cerrado en pendings).

## Fase 5 — Mejora continua (12.5.0)
- **P3.13** Ampliar suite E2E (`e2e/specs/`) con flujos CRM→Cotización→Embarque y multi-tenant switch (los 5 specs actuales se mantienen).
- **P3.14** Documentar convención `useXxx` en `docs/conventions.md` + regla ESLint custom (hook real vs helper puro).
- **P3.16** Introducir `Result<T,E>` en `lib/result.ts` y migrar 3 services piloto: `embarque/mutations`, `facturas/mutations`, `cotizacion/mutations`.

---

## Detalles técnicos comunes
- Por fase: cambios → `bun run audit:arch` → `vitest run` afectados → `supabase--linter` solo si tocó SQL (no aplica en este plan) → bump `APP_VERSION` + bloque `## [X.Y.Z] - YYYY-MM-DD` en `CHANGELOG.md` (root) → actualizar `mem://audit/pendings` cerrando ítems.
- Power of 10 obligatorio (componentes ≤200, sin `any`, cleanup en effects, manejar `error` de Supabase).
- Mantener `architecture-baseline.test.ts` verde.
- Sin cambios visuales salvo C10/C11.
- Sin nuevas features.
- `as unknown as T` solo en `src/lib/supabase/cast.ts`.

## Orden sugerido
1. Fase 1 (cierra regresiones recientes, rápido).
2. Fase 2 (cosmético, bajo riesgo).
3. Fase 3 (zod, base para robustez).
4. Fase 4 (complejidad, ya con código más modular).
5. Fase 5 (mejora continua, incremental).

## Fuera de alcance
- Nuevas features de producto.
- Cambios visuales no listados.
- WARN preexistentes del linter Supabase (extensions in public, SECURITY DEFINER portal) — deuda asumida.
- `src/pdf/theme/styles.ts` (react-pdf, exento).
- Smoke test manual.
