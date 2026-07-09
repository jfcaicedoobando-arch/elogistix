# Bundle Lote 7e · DRY-3, DRY-4, DRY-5, DRY-6

Cerramos el bloque de **cleanup pequeño** del backlog en una sola versión menor. Todos los cambios son de **presentación** (formatters + literales de ruta): no tocan lógica de negocio, RLS ni queries.

---

## Analogía rápida

Hoy tenemos **cuatro reglas iguales escritas cuatro veces** en la casa (formatters de dólares, formatters de pesos, rutas del portal, y el `toLocaleString` suelto). Vamos a dejar **una sola regla oficial** en la cocina (`@/lib/formatters`, `@/constants/routes`) y a que todos los cuartos usen esa. Si mañana cambia el formato, se cambia en un solo lugar.

---

## Alcance (4 sub-ítems)

### DRY-3 · Unificar `usdFormatter` en `costeo`

Hoy existen **dos** versiones:

- `src/features/costeo/routes/CosteoTarifas.helpers.ts` → `usd(n)` + `usdFormatter = { format: usd }` (objeto).
- `src/features/costeo/components/TarifaForm.helpers.ts` → `usdFormatter(n)` (función).

**Acción:**
1. Añadir un helper canónico `formatUSD(n)` en `src/lib/formatters/numbers.ts` (wrapper sobre `formatCurrency(n, "USD")`) — ya usado internamente, sólo se expone.
2. Reemplazar los dos `usdFormatter` locales por el import canónico.
3. Ajustar `TarifaForm.tsx` y `CosteoTarifas.helpers.test.ts` a la nueva firma (función `(n) => string`).

### DRY-4 · Formatters de moneda locales en `cierreCheckFormatters.ts`

El archivo mantiene un `fmtMoney(n, moneda)` local que ya delega en `formatCurrency`. La duplicación real es el manejo defensivo (`Number.isFinite`). Se mueve al canónico.

**Acción:**
1. Añadir `formatCurrencySafe(n, currency)` en `@/lib/formatters/numbers.ts` (misma lógica: `Number(n)` + `isFinite` fallback a `String(n)`).
2. `cierreCheckFormatters.ts` reemplaza `fmtMoney` por `formatCurrencySafe`.
3. Actualizar test si aplica.

### DRY-5 · Builders `portal.*` en `@/constants/routes`

Ya existe `ROUTES.PORTAL_*` y `buildRoute.portalEmbarque(id)`. Faltan constantes que se usan como rutas de "vuelta" (`/portal/embarques`, `/portal/cotizaciones`, `/portal/facturas`, `/portal/login`, `/portal/perfil`) en 6 archivos con literales inline.

**Acción:**
1. No hace falta crear constantes nuevas (ya están en `ROUTES`); el hallazgo real es que los call-sites usan literales.
2. Reemplazar literales `"/portal/embarques"`, `"/portal/cotizaciones"`, `"/portal/facturas"`, `"/portal/login"`, `"/portal/perfil"` por `ROUTES.PORTAL_*` en:
   - `PortalUserMenu.tsx`, `PortalLayout.tsx`, `PortalFacturaDetalle.tsx`, `PortalCotizacionDetalle.tsx`, `PortalEmbarqueDetalle.tsx`, `PortalProximosArribosCard.tsx`, `PortalEmbarquesRecientesCard.tsx`, `PortalFacturacionPendienteCard.tsx`, `PortalKpiGrid.tsx`, `portalNav.ts`.
3. **NO** se tocan tests (`makeWrapper("/portal/embarques")`) porque son rutas del router de prueba — no consumidores.

### DRY-6 · Migrar `.toLocaleString("es-MX")` numérico a `formatNumber()`

De los 15 sitios encontrados, la mayoría son **fechas** (`new Date().toLocaleString("es-MX")`) — ésos NO se tocan (son fechas, no números).

Los **numéricos** son 9 sitios:

- `SeccionContenedoresReadonly.tsx` (peso_kg, volumen_m3) — 2 líneas.
- `_helpers.tsx` (auditoria ejecutivo) — 1 línea.
- `AuditoriaKpis.tsx` — 1 línea.
- `Diagnostico.tsx` (total registros) — 1 línea.
- `HealthKpisRow.tsx` — 4 líneas.
- `HealthSlowestTable.tsx` — 1 línea.

**Acción:** reemplazar `n.toLocaleString("es-MX")` por `formatNumber(n)`. Comportamiento idéntico para enteros (sin decimales); para floats mantiene 2 decimales — no aplica en estos sitios porque todos son conteos enteros.

---

## Detalles técnicos

**Archivos modificados (estimado ~14):**

```text
src/lib/formatters/numbers.ts                     (+2 helpers)
src/features/costeo/routes/CosteoTarifas.helpers.ts
src/features/costeo/components/TarifaForm.helpers.ts
src/features/costeo/components/TarifaForm.tsx
src/features/costeo/components/__tests__/TarifaForm.helpers.test.ts
src/features/embarques/utils/cierreCheckFormatters.ts
src/features/portal/components/layout/PortalUserMenu.tsx
src/features/portal/components/PortalLayout.tsx
src/features/portal/components/layout/portalNav.ts
src/features/portal/routes/PortalFacturaDetalle.tsx
src/features/portal/routes/PortalCotizacionDetalle.tsx
src/features/portal/routes/PortalEmbarqueDetalle.tsx
src/features/portal/components/dashboard/PortalProximosArribosCard.tsx
src/features/portal/components/dashboard/PortalEmbarquesRecientesCard.tsx
src/features/portal/components/dashboard/PortalFacturacionPendienteCard.tsx
src/features/portal/components/dashboard/PortalKpiGrid.tsx
src/features/embarques/components/contenedores/SeccionContenedoresReadonly.tsx
src/features/auditoria/components/AuditoriaKpis.tsx
src/features/auditoria/components/ejecutivo/_helpers.tsx
src/features/admin/routes/Diagnostico.tsx
src/features/admin/components/diagnosticoHealth/HealthKpisRow.tsx
src/features/admin/components/diagnosticoHealth/HealthSlowestTable.tsx
CHANGELOG.md
src/constants/appVersion.ts
```

**Versión:** bump a `13.233.0` (minor por DRY refactor sin cambios funcionales).

**Reglas respetadas:** memory `core` (financialUtils/formatters centralizados), Power-of-10 (helpers puros, sin any), y `constants/routes.ts` como fuente única.

---

## Riesgos

- **Rutas del portal:** si algún literal se olvida, el usuario sigue navegando a la ruta correcta (son idénticos). Riesgo cero funcional; sólo pérdida de la ganancia DRY.
- **Formatters:** `formatCurrency` con `USD` produce `"US$1,234.00"`; el `usdFormatter` viejo también. Se validará con un smoke rápido.
- **`formatNumber` vs `.toLocaleString`:** para enteros producen exactamente el mismo string.

---

## Verificación

1. `bun run typecheck` y `bun run lint --max-warnings 0`.
2. `bun test src/features/costeo` y `bun test src/features/embarques/utils`.
3. Vista rápida en preview: `/costeo/tarifas`, `/auditoria`, `/admin/diagnostico`, `/portal/*`.

---

## Siguiente después de este bundle

DRY-7 (`useDebouncedValue` compartido, S) → luego AUD-1 (migración RPC, M).

**¿Confirmo y arranco?**
