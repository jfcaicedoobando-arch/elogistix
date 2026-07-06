## Contexto

El CI verde reporta cobertura global:
- **Statements** 42.46% · **Branches** 37.12% · **Functions 31.75%** · **Lines** 42.82%
- 4125 tests pasan en 582 archivos.

El umbral de funciones está apenas ~2 pts por encima del mínimo actual (30%). Muchos archivos `.ts` puros (services, helpers, mappers, constants) siguen en **0/0/0/0**, lo cual es el mejor blanco costo/beneficio: son fáciles de testear porque no requieren `render`, `Supabase` real ni mocks React.

## Objetivo

Subir cobertura global de **funciones ≥ 40%** (y arrastrar statements/lines a ~50%) sin tocar código de producción salvo type-only.

## Estrategia

Analogía: en lugar de testear cada botón (caro), le ponemos "termómetros" a la mecánica interna — las funciones puras — que ya usa el sistema. Un test barato cubre muchas funciones a la vez.

Ordenamos por ROI: helpers/servicios de dominio con lógica de negocio primero; hooks y componentes UI después (más costosos).

## Lotes

### Lote 1 — Helpers puros y mappers (ROI alto)
Archivos objetivo (todos actualmente 0%):
- `src/features/costeo/**/*Submit.ts`, `*Tarifa.ts`, `*Rutas.ts`, `*Tarifas.ts`
- `src/features/cliente/**/cliente.ts`, `clienteForm.ts`
- `src/features/configuracion/**/*.ts` (`useConfiguracion`, `useConfiguracionGlobal`, `useConfiguracionOrg` — extraer partes puras si son hooks)
- `src/features/auditoria/services/**` (`asignar.ts`, `marcar.ts`, `desmarcar.ts`, `query.ts`, `analyzeHallazgo.ts`)
- Utilidades sueltas: `columnMeta.ts`, `useRowSelection.ts` reducers, `pnlPorContenedor.helpers` extras.

Aproximado: **~25 archivos** → ~60 tests nuevos.
Estimación: sube funciones a ~38%.

### Lote 2 — Servicios con Supabase (ROI medio)
Aplicar patrón `_supabaseChainMock` (ya establecido en el proyecto) para:
- `admin/services/*` (bandejas, portales, `capacidadUsuarios`, `usePapelera`)
- `features/comisiones/services/*Devengadas.ts`
- `features/facturapi/**/credenciales.ts`
- `features/auditoria/services/auditoriaSnapshots.ts`, `revisarHallazgo.ts`, `resolveHallazgo.ts`

Aproximado: **~15 archivos** → ~40 tests.
Estimación: sube funciones a ~42%.

### Lote 3 — Componentes de baja complejidad (opcional)
Solo si no llegamos a 40% después de los lotes 1-2. Cubrir componentes shared con render + assertion básica:
- `KpiCard.tsx`, `KpiStrip.tsx`, `EmptyState.tsx`, `FormDialogSection.tsx`, `ReasonDialog.tsx`, `NumericInput.tsx`, `PaginationControls.tsx`.

## Fuera de alcance

- No modificar `vitest.config.ts` ni bajar umbrales (memoria core).
- No tocar componentes ya con >70% cobertura.
- No perseguir 100% en rutas/páginas grandes (`admin/routes`, portales) — bajo ROI.
- No incluir tests E2E ni Playwright.

## Verificación

1. Correr `bunx vitest run --coverage` local sobre carpetas modificadas.
2. Confirmar que el reporte muestra funciones ≥ 40% globales.
3. Bump de `APP_VERSION` + entrada en `CHANGELOG.md` al final de cada lote.

## Detalles técnicos

- Usar `vi.mock('@/integrations/supabase/client', ...)` con el helper `_supabaseChainMock.ts` existente para servicios.
- Los helpers puros no requieren mock: `import { fn } from '...'; expect(fn(input)).toEqual(...)`.
- Coverage ignora archivos `*.types.ts` e `index.ts` re-exports; los saltamos.
- Cada lote termina con `mem://index.md` intacto y CHANGELOG bumpeado.

¿Confirmas empezar por el **Lote 1**?
