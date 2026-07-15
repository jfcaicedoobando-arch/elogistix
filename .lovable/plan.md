
## Auditoría de Batch G (v13.300.36)

**Estado de tests**: 24 archivos verdes en los módulos tocados (tesorería, presupuesto, dashboard ejecutivo, embarques, profit). Ningún regresivo.

**Bugs encontrados**:

1. **Lint blocker en `invalidateProfitDependencies.ts:16`** — `queryKey: ["profit"]` inline viola la regla `no-restricted-syntax`. Preexistente pero ahora ejecutado en muchas más mutaciones. Fix: agregar `profit.all = ["profit"] as const` a `src/features/profit/queryKeys.ts` y usar `queryKeys.profit.all`.

2. **`useResumenTesoreria` perdió la key de caché por org** — al recomponerse en el hook (ya no llama al servicio), no hay `useQuery`, por lo que depende de las queries hijas. Está bien funcionalmente, pero pierde consistencia con el patrón. Verificar que `useCobranza` y `useFacturasCxP` ya filtren por org (revisar servicios).

3. **Riesgo con `organizationId` null** — si el usuario no tiene org activa (edge case durante login), `?? null` propaga null y el servicio salta el filtro devolviendo TODO. RLS lo protege pero mejora higiénica: no ejecutar la query hasta tener orgId.

**Tests nuevos requeridos**:
- `resumen.tenancy.test.ts` — verificar que `fetchSaldosCuentas("org-A")` pasa `.eq("organization_id", "org-A")`.
- `flujoProyectado.tenancy.test.ts` — verificar filtro `organization_id` + `deleted_at is null`.
- `vsReal.tenancy.test.ts` — verificar ambos filtros en `proveedor_facturas` y `liquidaciones_comision`.
- `invalidateProfitDependencies.test.ts` — verificar que invalida las 3 keys correctas.
- `useCreateEmbarque.profitInvalidation.test.tsx` (extender existente) — verificar que se dispara `invalidateProfitDependencies` en `onSuccess`.

## Fase H — Unificar fuente EERR + persistencia + guardias

**Contexto**: Sub-agent `sub_tswyqaz2` detectó que Dashboard Ejecutivo usa siempre EERR devengado, mientras que la ruta `/profit/estado-resultados` deja al usuario elegir entre `devengado` y `pagado`. Esto genera KPIs contradictorios entre pantallas.

**Cambios propuestos**:

1. **Store de preferencia de fuente EERR** (`src/features/profit/hooks/useFuenteEerr.ts`)
   - Lee/escribe `localStorage` con clave `profit.eerr.fuente` vía el wrapper `browserStorage` (regla `mem://technical/browser-storage`).
   - Valores válidos: `"devengado" | "pagado"`. Default: `"devengado"`.
   - Retorna `{fuente, setFuente}` con `useSyncExternalStore` para reaccionar entre tabs.

2. **Propagar `fuente` al agregador**
   - `fetchDashboardEjecutivo({ fuente })` acepta parámetro.
   - Reemplazar `fetchEstadoResultadosDevengado` por selector `fetchEstadoResultados[fuente]` en las 14 llamadas (periodo + previo + 12 meses).
   - QueryKey `dashboardEjecutivo` incluye `fuente` para no colisionar caché.

3. **Selector de fuente en Dashboard**
   - Toolbar en `ProfitDashboardEjecutivo.tsx` con `ToggleGroup` (Devengado / Pagado).
   - Reutiliza el mismo hook `useFuenteEerr` que ya usa `/profit/estado-resultados` → un cambio se refleja en ambos.

4. **Guardia de query cuando falta orgId**
   - En `useSaldosCuentas`, `useFlujoProyectado`, `usePresupuestoVsReal`: `enabled: !!organizationId`.
   - Evita fetch inicial sin filtro (defense-in-depth sobre RLS).

5. **Tests**
   - `useFuenteEerr.test.ts` — persistencia, default, cross-tab sync.
   - `agregador.fuente.test.ts` — verificar que llama `fetchEstadoResultadosPagado` cuando `fuente="pagado"`.
   - Extender los tests de tenancy del audit para incluir `enabled: false` cuando `organizationId` es null.

## Detalles técnicos

**Archivos a editar (audit)**:
- `src/features/profit/queryKeys.ts` — agregar `all`.
- `src/features/profit/hooks/invalidateProfitDependencies.ts` — usar `queryKeys.profit.all`.

**Archivos a crear (fase H)**:
- `src/features/profit/hooks/useFuenteEerr.ts`
- `src/features/profit/hooks/__tests__/useFuenteEerr.test.ts`
- `src/features/tesoreria/services/__tests__/resumen.tenancy.test.ts`
- `src/features/tesoreria/services/__tests__/flujoProyectado.tenancy.test.ts`
- `src/features/presupuesto/services/__tests__/vsReal.tenancy.test.ts`
- `src/features/profit/hooks/__tests__/invalidateProfitDependencies.test.ts`
- `src/features/dashboardEjecutivo/services/__tests__/agregador.fuente.test.ts`

**Archivos a editar (fase H)**:
- `src/features/dashboardEjecutivo/services/agregador.ts` — parámetro `fuente`.
- `src/features/dashboardEjecutivo/hooks/useDashboardEjecutivo.ts` — leer `useFuenteEerr` y propagar.
- `src/features/dashboardEjecutivo/queryKeys.ts` — incluir `fuente` en la key.
- `src/pages/profit/ProfitDashboardEjecutivo.tsx` — toolbar selector.
- `src/features/profit/hooks/useEstadoResultados.ts` — migrar a `useFuenteEerr` (deduplica lógica de localStorage).
- Hooks de tesorería/presupuesto — `enabled: !!organizationId`.

**Bump**: `APP_VERSION → 13.300.37` + entrada en `CHANGELOG.md`.

**Verificación**: `bun run lint`, `bunx vitest run src/features/profit src/features/tesoreria src/features/presupuesto src/features/dashboardEjecutivo`.
