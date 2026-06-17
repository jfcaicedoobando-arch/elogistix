# Auditoría arquitectónica — plan de remediación

## Veredicto general
La arquitectura es **fundamentalmente sólida**: aislamiento de features perfecto (0 imports cruzados), Supabase confinado al service layer, React Query usado en todo el árbol, lazy loading completo y un sistema propio de clasificación de `as`-casts. La nota negativa concentrada está en (a) huecos de testing en operaciones financieras críticas, (b) `SELECT *` en tablas financieras y (c) un anti-patrón puntual de mutación en render.

---

## 🔴 Crítico (atender ya)

1. **Tests faltantes en cierre/timbrado/seguros**
   - `src/features/embarques/components/TabCierre.tsx`, `TabSeguros.tsx`, `DialogSeguroForm.tsx`
   - `src/features/facturacion/components/DialogTimbrarFactura.tsx`
   - Cubrir: validación de checks, gating por rol (`puedeCerrar`/`puedeReabrir`), confirmación tipada, motivo ≥20, estados loading/error.

2. **`SELECT *` en tablas financieras**
   - `src/features/comisiones/services/liquidaciones.ts:12`
   - `src/features/comisiones/services/vendedoras.ts:36`
   - `src/features/tesoreria/services/cuentas.ts:10`, `conciliacion.ts:62`
   - `src/features/cxp/services/pagosProveedor.ts:13`
   - Reemplazar por una constante `COLUMNS` por servicio (patrón ya usado en `seguros.ts`).

3. **Mutación de estado en cuerpo de render**
   - `src/features/admin/components/TabSeguridadGlobal.tsx:30-43`
   - Pasar la inicialización a `useEffect` o a `defaultValues` de `react-hook-form`.

## 🟠 Alto (próximo sprint)

4. **Cobertura cero en `operaciones` y casi cero en `reportes`** — agregar pruebas de servicios y hooks.
5. **Decomponer `TabPnl.tsx` (289 líneas)** → `PnlKpiGrid`, `PnlConceptosTable`, `PnlProveedoresTable`; mover `delta`/`pct`/`fmt` a `src/lib/formatters/numbers.ts`.
6. **Eliminar acoplamiento `comisiones → admin`**
   - `src/features/comisiones/services/vendedoras.ts:8` importa `fetchAvailableUsers` de `admin/services/members`.
   - Mover a `src/services/usuario.ts` (ya existe).
7. **Mover Facturación de `pages/` a `features/`**
   - `src/pages/facturacion/Facturacion.tsx` (198) y `facturacionColumns.tsx` (189) → `src/features/facturacion/components/`.
8. **Añadir `.limit()/.range()` a las 16 consultas sin paginación** (incluye `admin/services/observability.ts:72`).
9. **`src/routes/appRoutes.tsx` (218 líneas)** — extraer subrutas CRM a `src/routes/crmRoutes.tsx`.

## 🟡 Medio (refactor planeado)

10. **28 colores hardcodeados** (`text-white`, `bg-black`, etc.) en componentes de `dashboard`, `portal`, `embarques/facturacion` y `pages/dashboard/Operaciones.tsx` → tokens semánticos (`text-primary-foreground`, `bg-background`).
11. **`src/components/shared/utils/` (10 archivos no-componente)** → mover a `src/lib/` o `src/constants/` (`auditoriaConfig`, `authSnapshot*`, `errorDetailsStore`, `errorReportFormat`, `estadoConfig`, `kpiTones`, `uiMappings`, etc.).
12. **Hook `useCotizacionesPageController.ts` (191 líneas)** → dividir en `useCotizacionFilters`, `useCotizacionPagination`, `useCotizacionActions`.
13. **Extraer `useCierreDialog` desde `TabCierre.tsx`** (4 `useState` de orquestación de diálogos).
14. **`src/features/costeo/routes/CosteoTarifas.tsx` y `CosteoRutas.tsx`** — los formularios completos viven en `routes/`; mover el cuerpo del form a `components/` y dejar las rutas ≤30 líneas.
15. **`src/features/misc/`, `bandejas/` (sin components/), `onboarding/` (solo services)** — documentar propósito o eliminar el shell vacío.
16. **Constantes `COLUMNS` por servicio** — patrón consistente para evitar strings de proyección repetidos.

## 🔵 Opcional (calidad de vida)

17. Mover orquestación de `pages/clientes/Clientes.tsx` y `pages/cotizaciones/Cotizaciones.tsx` a `features/`.
18. Dividir `src/features/portal/services/queries.ts` (190 líneas) por dominio (embarques / facturas / perfil).
19. Evaluar fusionar `dashboardEjecutivo` como sub-carpeta de `dashboard`.
20. Renombrar tests de fixtures bajo `src/test/` para que el clasificador de casts los detecte automáticamente como LOW.

---

## Cómo ejecutar
- **Bloques 1–3** se hacen como un único PR de seguridad (tests + columns + render fix). Ningún cambio de UX.
- **Bloques 4–9** se distribuyen en 2–3 PRs por área (financiero, embarques, rutas).
- **10–16** se atacan cuando se toque cada archivo (regla del *boy scout*).
- **17–20** son backlog.

Cuando confirmes, arranco con el bloque Crítico (sin tocar UI, solo tests, tipos y refactor de servicios).
