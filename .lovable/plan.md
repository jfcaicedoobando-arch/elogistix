# Plan: Cerrar pendientes auditoría arquitectónica (12.x)

Objetivo: liquidar toda la deuda registrada en `mem://audit/pendings`. Se agrupa por fases ordenadas de menor a mayor riesgo, cada una es una versión menor independiente con su propio `CHANGELOG.md` y bump de `APP_VERSION`.

---

## Fase 1 — Cosmético / Power of 10 (12.1.0)
Riesgo bajo, sin cambios de comportamiento.

- **B6** Split `ImportarLeadsCsvDialog` (202) y `BulkImportDialog` (201): extraer `useImportarLeadsCsv` / `useBulkImport` + subcomponentes (`PreviewTable`, `MappingStep`, `ResultSummary`). Objetivo ≤200 líneas.
- **B7** Documentar excepción de `components/ui/sidebar.tsx` (shadcn base) en `docs/power10-baseline.md`.
- **C10** Auditar los 25 `style={{…}}` inline. Reemplazar por clases Tailwind o tokens; dejar SAFE-CAST con justificación en los casos válidos (react-pdf, virtualizer, % dinámico, color desde DB) según `mem://principles/inline-styles`.
- **C11** Homogeneizar prefijos: renombrar `Configuracion.tsx` → `TabConfiguracion.tsx` (o viceversa según convención dominante) y normalizar pestañas dentro del mismo módulo.

## Fase 2 — Reorganización CRM y rutas (12.2.0)
Renombres puros + reubicación, sin tocar lógica.

- **C9** Mover/renombrar `hooks/crm/{automatizacionesEtapaActions, leadEditDirty, oportunidadFormHelpers, oportunidadPayload}`:
  - Shims tras Lote 4 → mover a `lib/crm/` con nombre sin prefijo `use*`.
  - Los que sí son hooks reales mantenerlos en `hooks/crm/` con nombre `useXxx`.
- **D12** Dividir `src/routes.tsx` en `routes/{admin,portal,crm,public}.tsx` + `routes/index.tsx` que componga. Mantener lazy-loading y guards actuales.

## Fase 3 — Zod en boundary Supabase (12.3.0)
- **P1.7** Crear schemas zod para embarques, facturas y cotizaciones en `lib/schemas/`. Reemplazar `fromDb<T>()` por `Schema.parse()` en `services/{embarque,facturas,cotizacion}/queries/*`. Errores de parseo → `console.error` + fallback seguro (no romper UI). Tests por schema con fixture real.

## Fase 4 — Romper servicios "god" (12.4.0)
- **P1.6** Split:
  - `services/facturas/proyeccion.ts` → `proyeccion/{calculator,grouper,formatter}.ts`.
  - `services/cotizacion/mutations.ts` → `mutations/{create,update,duplicate,delete,status}.ts`.
  - `services/facturas/huecoFacturacion.ts` → `huecoFacturacion/{detector,resolver,reporter}.ts`.
- Mantener API pública vía `index.ts` para evitar cambios en consumidores.

## Fase 5 — Unificación utils (12.5.0)
- **P1.5** Consolidar `src/utils/`, `src/lib/utils.ts` y `src/lib/utils/` en:
  - `lib/utils/` (helpers puros de presentación)
  - `lib/io/` (parsing, IO, formato)
- Migración con `git mv` lote por lote + codemod de imports + `bun run audit:arch` verde tras cada lote.

## Fase 6 — Bajar complejidad ciclomática (12.6.0)
- **Refactor complexity** Las 13 funciones en `src/` con complexity 15:
  - Extraer guards tempranos, mover ramas a helpers en `lib/`.
  - Una vez todas ≤12, bajar guardrail ESLint `complexity: ["error", 12]`.
- **Edge functions** Mismo tratamiento en `supabase/functions/{create-user, delete-user, invite-client-user}` (15) y `_shared/jsoncargoSync` (14). Cubrir con tests `supabase--test_edge_functions` antes y después.

## Fase 7 — Mejora continua (12.7.0)
- **P3.13** Ampliar suite E2E: flujos CRM→Cotización→Embarque, portal cliente, multi-tenant switch.
- **P3.14** Convención de nombres hooks: documentar en `docs/conventions.md` + regla ESLint custom (`useXxx` solo si retorna hook real).
- **P3.15** Split `TrackingPublico` (página pública de tracking) en subcomponentes + hook de datos.
- **P3.16** Introducir patrón `Result<T,E>` en `lib/result.ts` y migrar 3 services piloto (`embarque/mutations`, `facturas/mutations`, `cotizacion/mutations`).

---

## Detalles técnicos comunes

- Por cada fase: rama mental → cambios → `bun run audit:arch` → tests → `supabase--linter` (solo si tocó SQL) → bump `APP_VERSION` + bloque en `CHANGELOG.md` (root).
- Mantener baseline arquitectónico vacío (`architecture-baseline.test.ts` debe seguir verde).
- Cumplir Power of 10 (`mem://principles/power-of-10`): componentes ≤200, sin `any`, cleanup en effects, manejar `error` de Supabase.
- Actualizar `mem://audit/pendings` al final de cada fase eliminando los ítems cerrados.
- Sin cambios visuales salvo C10/C11.
- Sin nuevas features.

## Orden sugerido de ejecución
1. Fase 1 (rápida, alto valor cosmético).
2. Fase 2 (renombres, bajo riesgo).
3. Fase 3 (zod, base para todo lo demás).
4. Fase 4 (split servicios apoyado en zod).
5. Fase 5 (utils, requiere fases previas estables).
6. Fase 6 (complejidad, ya con código más modular).
7. Fase 7 (mejora continua, opcional/incremental).

## Fuera de alcance
- Nuevas features de producto.
- Cambios de diseño visual no listados.
- WARN preexistentes del linter Supabase (extensions in public, SECURITY DEFINER portal) — se mantienen como deuda asumida.
- Smoke test manual.
