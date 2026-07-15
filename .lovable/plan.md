
# Fase 3 — Auditoría Batch B+D y Batch E–F del módulo Profit

## Parte 1 · Auditoría de la fase anterior

Revisé `usePeriodoMesUrl`, `invalidateProfitDependencies`, las 5 mutaciones parcheadas y `TabVsReal`. El resultado:

| Área | Estado | Notas |
|---|---|---|
| Sync back/forward | ✅ | `useEffect(qp)` |
| Canonicalización URL | ✅ | Reescribe con `replace: true` |
| `setMesKey` estable | ✅ | Callback funcional |
| `minMes` vacío | ✅ | Guard con `MES_VACIO` |
| Prefijo `["profit"]` | ✅ | Coincide con `queryKeys.profit` (no expone `.all`, el prefijo string funciona por matching parcial de React Query) |
| Invalidación cruzada | ✅ | 5 mutaciones parcheadas |
| Tests | ✅ | 18/18 verdes |

**Gaps detectados (menores, se corrigen en esta fase):**

1. **Falta invalidar profit en `useRegistrarPagoSubmit`** (registrar pago cliente): impacta `cartera_vencida_mxn` y KPIs de cobro.
2. **Falta invalidar en `useAcuseCancelacion`** (cancelación de factura de cliente): impacta ingresos del mes.
3. **Falta invalidar en `useAprobarFactura`** (aprobación CxP): activa el gasto en resultados.
4. **No hay test de contrato para `invalidateProfitDependencies`**: cualquier cambio futuro en `queryKeys.profit` podría silenciosamente dejar de invalidar.

## Parte 2 · Batch E — Drill-downs de KPIs

Los KPIs del Dashboard Ejecutivo (Utilidad operativa, Cartera vencida, Ingresos del mes) son "vidrieras" — el usuario ve el número pero no puede navegar al detalle. Objetivo: cada KPI clickeable abre un panel lateral (`Sheet`) con la lista subyacente.

**Componentes:**

- `KpiDrilldownSheet.tsx` — shell reutilizable con título + tabla + botón "Ver todos en [módulo]".
- `useKpiDrilldownData.ts` — hook que resuelve por `kpiId` la fuente:
  - `utilidad_operativa` → embarques del mes con `utilidad_mxn` (link a Embarques).
  - `cartera_vencida` → facturas con `dias_vencido > 30` (link a Cobranza).
  - `ingresos_mes` → facturas timbradas del mes (link a Facturación).
  - `egresos_mes` → CxP aprobadas del mes (link a CxP).
- `KpiCard` recibe `onDrilldown?: () => void` — cursor pointer + focus ring cuando existe.

**UX:** tabla compacta (10 filas + "Ver todos"), formateo consistente con `formatCurrency`, badges de estado, click en fila navega al detalle.

## Parte 3 · Batch F — Forecast multi-mes con banda de confianza

La Proyección actual muestra sólo el mes seleccionado. El usuario ejecutivo necesita ver la tendencia. Objetivo: gráfico multi-mes (últimos 6 reales + próximos 3 proyectados) con banda de confianza y comparativo YoY.

**Servicio:**

- `fetchForecastMultiMes(organizationId, mesActual, meses = 9)` — arma serie con:
  - `realizado`: suma real por mes (facturas timbradas).
  - `proyectado`: para meses futuros usa embarques con ETA + tarifas.
  - `banda_min` / `banda_max`: ±15% sobre proyectado (heurística inicial documentada; se puede afinar con desviación histórica en fase posterior).

**Componente:**

- `ForecastMultiMesChart.tsx` — `<ComposedChart>` de Recharts: barras reales, línea proyectada, `Area` para banda de confianza. Tooltip con MXN formateado, línea vertical "hoy". Empty state y skeleton reales.

**Testing (audit Parte 1 + fase nueva):**

- `invalidateProfitDependencies.test.ts` — contrato: 3 invalidaciones exactas (dashboardEjecutivo, presupuesto, profit).
- Tests de invalidación cruzada en las 3 mutaciones adicionales (spy sobre `queryClient.invalidateQueries`).
- `useKpiDrilldownData.test.tsx` — 4 casos (uno por kpiId) verificando fuente y filtro por organización.
- `fetchForecastMultiMes.test.ts` — serie coherente, banda simétrica, exclusión de "Cancelado", filtro org.

## Detalles técnicos

- Sin migraciones DB en esta fase.
- El `Sheet` de drill-down reutiliza `@/components/ui/sheet` (ya existente).
- `Recharts` ya está instalado.
- `APP_VERSION` → `13.300.33`.
- CHANGELOG entry único cubriendo audit gaps + Batch E + Batch F.

## Salida esperada

- 3 hooks parcheados + 1 helper con test de contrato → cierra el hueco de invalidación.
- Drill-downs funcionales en los 4 KPIs principales del Dashboard Ejecutivo.
- Gráfico de forecast con banda de confianza en Proyección de Facturación.
- ~8 tests nuevos, todos verdes.
