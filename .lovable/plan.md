# Fase 2 — Refactor de severidad Alta

Continuación del plan de auditoría arquitectónica (Fase 1 ya cerrada con tests).
Fase 2 ataca **5 items**: extraer reglas de negocio, mover formatters, encapsular queries de página, sacar loops bulk-insert de la UI y migrar servicios globales a sus features.

---

## 1. Extraer reglas de negocio de bandejas → `features/bandejas/domain/`

Las páginas `src/pages/bandejas/*` (Cartera, CxpPorCapturar, CxpPorPagar, FacturacionPorEmitir) hoy contienen filtros, agregados y reglas (días vencidos, prioridad, semáforos) mezclados con JSX y fetching.

- Crear `src/features/bandejas/domain/` con funciones puras (`clasificarCartera`, `calcularDiasVencidos`, `prioridadCxp`, `huecosFacturacionFiltrados`).
- Cada función con su `__tests__/*.test.ts` (Vitest, sin Supabase).
- Las páginas sólo consumen el output del hook + domain.

## 2. Mover formatters dispersos → `src/lib/formatters/`

Hoy hay `formatDate`, `formatPercent`, `pctPnl`, `formatCurrency`, `formatMoney`, etc. duplicados en componentes y features.

- Consolidar todo en `src/lib/formatters/` con un barrel.
- Reemplazar todos los imports (`@/lib/formatters`).
- Eliminar copias locales (`PortalNotificationsBell.formatDate`, alias `calcularSubtotal`, `uiMappings.ts`).
- Test de arquitectura: prohibir re-declaración local de estas funciones fuera de `src/lib/formatters/`.

## 3. Wrapper hooks para queries de página

Páginas hoy llaman `useQuery` directo con keys ad-hoc (rompen la regla "Page → hook → service").

- Auditar `src/pages/**` y por cada `useQuery` inline crear `useXxxPage()` en el feature correspondiente.
- Página recibe sólo `{ data, isLoading, error }` listos.
- Test de arquitectura: `src/pages/**/*.tsx` no puede importar `@tanstack/react-query` directamente (salvo `useQueryClient` para invalidaciones controladas).

## 4. Extraer loops `bulk-insert` fuera de JSX

Detectados en wizard embarque/cotización: bucles que arman payloads grandes dentro de `onClick`/`onSubmit`.

- Mover lógica a servicios (`crearEmbarqueBulk`, `crearConceptosBulk`, etc.).
- JSX queda con `await service(...)` + manejo de errores.

## 5. Migrar servicios globales a su feature

Servicios sueltos en `src/services/` que pertenecen a un dominio.

- `unsubscribeService.ts` → `src/features/auth/services/` (o mantener si no hay feature `auth/` lo dejamos justificado).
- Revisar otros archivos en `src/services/` (mover los específicos, mantener sólo los transversales).
- Actualizar imports y tests.

---

## Entregables

```text
src/features/bandejas/domain/
  ├── clasificarCartera.ts (+ test)
  ├── prioridadCxp.ts (+ test)
  └── huecosFiltro.ts (+ test)
src/lib/formatters/
  └── index.ts + tests (consolida date/money/percent)
src/features/<feature>/hooks/useXxxPage.ts (wrappers)
src/features/<feature>/services/  (loops bulk movidos)
src/__tests__/architecture/
  ├── pages-no-direct-usequery.test.ts
  └── no-local-formatters.test.ts
CHANGELOG.md + APP_VERSION bump a 13.60.0
```

## Técnico

- Cada item se entrega como bloque atómico con su test arquitectónico/unitario.
- Sin cambios de schema, sin migraciones, sin nuevas dependencias.
- Sin cambios funcionales visibles al usuario; sólo reorganización + tests.

## Fuera de alcance

- Fase 3 (toast, Sentry, magic strings, edge functions restantes).
- Fase 4 (renombrados kebab, inline styles, orfandades).
- Cambios de UI o lógica de negocio nueva.

## Pregunta

¿Ejecuto los 5 items en una sola tanda con un solo bump de versión (13.60.0), o prefieres revisar item por item antes de avanzar al siguiente?
