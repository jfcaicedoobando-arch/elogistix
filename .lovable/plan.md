## Auditoría de Batch A + C

Revisé lo aplicado ayer. Todo consistente **excepto un bug latente y falta de cobertura de tests**:

### Bug detectado
- `usePresupuestoMensualAnio` ahora depende de `useOrganization()` y desactiva la query si no hay `organizationId`. **El test existente** (`src/features/presupuesto/hooks/__tests__/usePresupuesto.test.tsx`) usa un wrapper sólo con `QueryClient` — el hook nunca dispara la query, `isSuccess` no llega y **el test va a fallar en CI**.

### Faltan tests que blinden las correcciones
- `fetchPresupuestoMensualAnio(anio, orgId)` — nadie prueba que se aplique el filtro `.eq("organization_id", ...)`.
- `fetchEmbarquesMes` — nadie prueba que se excluyan `estado='Cancelado'`.
- `calcularKPIsEjecutivos` — nadie prueba que "Cartera vencida" sume sólo deudores con `>30 días` (regresión fácil de volver a introducir).

### Batch B — Consistencia de periodo (siguiente fase)

Hoy tenemos **4 selectores de periodo distintos** en Profit:
- Dashboard: dropdown "Mes actual / Mes anterior" (`SelectorPeriodo`).
- Estado de Resultados: chevron ‹ › + `Select` con lista de meses.
- Presupuesto Vs Real: `MonthPickerMx`.
- Proyección: **sin selector**, siempre el mes en curso.

Además ningún selector persiste el periodo en la URL, así que refrescar pierde el contexto y no se puede compartir link con periodo fijo.

## Plan de trabajo

### Fase 1 · Fixes + tests de blindaje (Batch A tail)

1. **Fix hook test** `src/features/presupuesto/hooks/__tests__/usePresupuesto.test.tsx`
   - `vi.mock("@/lib/contexts/OrganizationContext", ...)` devolviendo `{ organizationId: "org-1" }`.
   - Verificar que `mockFetchMensual` sea llamado con `(2023, "org-1")`.
   - Añadir test: si `organizationId=null`, la query queda `enabled=false` y no fetch.

2. **Nuevo** `src/features/presupuesto/services/__tests__/mensual.organizationFilter.test.ts`
   - Verifica que `fetchPresupuestoMensualAnio(2026, "org-1")` invoque `.eq("organization_id", "org-1")` usando el chain mock.
   - Verifica que sin `organizationId` no se llame `.eq(...)`.

3. **Nuevo** `src/features/facturacion/services/proyeccion/__tests__/fetchSources.test.ts`
   - Verifica que `fetchEmbarquesMes` aplique `.neq("estado", "Cancelado")` y `.eq("organization_id", ...)` cuando se pasa `orgId`.

4. **Nuevo** `src/features/dashboardEjecutivo/services/__tests__/kpis.test.ts`
   - `calcularKPIsEjecutivos` con mezcla de deudores `dias:10` (no cuenta), `dias:35`, `dias:60`: `cartera_vencida_mxn` = suma sólo de los dos últimos; `cartera_vencida_count = 2`.
   - Caso todos ≤30 días: `cartera_vencida_mxn = 0`, `count = 0`.

### Fase 2 · Persistencia y unificación de periodo (Batch B)

5. **Hook compartido** `src/features/profit/hooks/usePeriodoUrl.ts`
   - Firma: `usePeriodoUrl(key = "periodo", defaultValue?)` → `{ periodo, setPeriodo, mesActual, mesAnterior, mesSiguiente }`.
   - Lee/escribe `?periodo=YYYY-MM` con `useSearchParams` (usa `replace: true`).
   - Fallback: valor guardado en `safeSessionStorage` con la key indicada; si no, mes actual.
   - Valida formato `YYYY-MM`, sanea valores inválidos al mes actual.

6. **Componente compartido** `src/features/profit/components/PeriodoMensualToolbar.tsx`
   - Recibe `{ value, onChange, min?, max? }`.
   - Renderiza: chevron ‹, `MonthPickerMx`, chevron ›. Consistente en las 4 páginas.
   - Sin PDF/Fuente/etc. — sólo control de mes.

7. **Migración de pantallas**
   - `ProfitDashboardEjecutivo.tsx`: reemplaza el `SelectorPeriodo` legacy por `usePeriodoUrl` + `PeriodoMensualToolbar`. Elimina el `preset` (ya no se muestra "YTD" desde Batch A y ya nadie usa `PresetPeriodo` fuera del dashboard).
   - `ProfitEstadoResultados.tsx`: sustituye `mesActual.key + setMesKey + irMesAnterior/irMesSiguiente` por `usePeriodoUrl`; conserva el toggle "Operativa/Devengada".
   - `TabVsReal.tsx` (presupuesto): usa `usePeriodoUrl("periodo_vs_real")` (key separada porque vive en otra pantalla).
   - `ProfitProyeccion.tsx`: agrega el `PeriodoMensualToolbar` en la cabecera y pasa `periodo` al hook `useProyeccionFacturacion` (hoy fijo a mes en curso).

8. **Legado**
   - `SelectorPeriodo.tsx` y `PresetPeriodo` quedan sin usos → eliminarlos + limpiar `STORAGE_KEYS.dashboardEjecutivoPeriodo` obsoleto.

9. **Tests nuevos**
   - `usePeriodoUrl.test.tsx`: lectura de `?periodo=`, escritura al cambiar, fallback a sessionStorage, sanitización de valores inválidos.
   - `PeriodoMensualToolbar.test.tsx`: click en chevrons cambia mes correctamente; respeta `min/max` cuando se pasan.

### Fase 3 · Cierre

10. `CHANGELOG.md` con entrada `## [13.300.31]` describiendo fixes de audit + unificación.
11. `APP_VERSION → "13.300.31"`.

## Detalle técnico

- El fix del hook test es crítico — si no se hace primero, el CI se queda rojo y no se puede mergear Batch B.
- `usePeriodoUrl` se coloca en `features/profit/hooks/` porque el consumo es intra-Profit + un consumidor en presupuesto (que hoy vive fuera pero se importa desde Profit). Si en el futuro lo necesitamos en Facturación o Tesorería, se sube a `src/lib/hooks/`.
- No se toca `useProyeccionFacturacion` internamente: sólo se le pasa el `periodo` que hoy calcula fijo — cambio mínimo de firma.
- La key `?periodo=` se comparte entre Dashboard, Estado de Resultados y Proyección porque conceptualmente representan el mismo periodo global; Presupuesto Vs Real usa `?periodo_vs_real=` porque es una sub-vista dentro de otra ruta con sus propios tabs.
- Persistencia: el hook usa `replace: true` en `useSearchParams` para no ensuciar el historial del navegador al cambiar de mes.

## Fuera de alcance de esta fase (para batches futuros)
- Batch D — performance del dashboard (N+1 de 14 llamadas).
- Batch E — drill-downs desde KPIs.
- Batch F — flujo de caja / forecast.
