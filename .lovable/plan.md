
# Auditoría del módulo Profit — Veredicto y roadmap

## Veredicto: **NO está listo para producción**

Hice auditoría visual en Full HD (1920×1080) de las 4 sub-vistas + revisión de código + spawn de subagente de lógica de negocio (en curso).

### Hallazgo crítico que reabre lo que creíamos cerrado

El **Dashboard Ejecutivo sigue crasheando** con `column liquidaciones_comision.deleted_at does not exist`. En Fase 1 (v13.300.40) sólo parché `flujoProyectado.ts`, pero el error real vive en **`src/features/presupuesto/services/vsReal.ts:53`** (y también hay filtros `deleted_at` en `estadoResultados.ts:44,49` y `estadoResultadosDevengado.ts:88,100` que apuntan a `proveedor_facturas` — esos sí existen, pero conviene auditar cada tabla).

**Analogía:** en Fase 1 tapé una fuga del baño de arriba, pero el agua venía también del baño de abajo. Hay que revisar los dos.

---

## Fase 2 — Blocker real (antes de cualquier otra cosa)

1. **Fix definitivo del crash Dashboard**
   - `vsReal.ts:50-54`: quitar `.is("deleted_at", null)` de la query a `liquidaciones_comision` (la tabla no tiene esa columna).
   - Agregar test de regresión que ejecute `useDashboardEjecutivo` completo con mocks y falle si alguna query referencia `deleted_at` sobre `liquidaciones_comision`.
   - Auditar TODAS las queries del módulo Profit contra el schema real: script que compara `.is("deleted_at", ...)` contra columnas de `types.ts` y falla el CI si hay mismatch.

2. **Rotura silenciosa de "Presupuesto vs Real"**
   - Misma causa: al hacer `Ver comparativo`, la query truena. Verificarlo tras el fix.

---

## Fase 3 — Lógica de negocio (post-subagente)

Batches propuestos, pendientes de confirmar con el reporte del subagente `sub_4bj3qdpw`:

- **B1 · Estado de Resultados / TC**: definir política única — TC del embarque vs TC del día — y documentarla en pantalla ("Conversión con TC del embarque"). Actualmente la fuente "Embarques" usa TC del embarque y la fuente "Facturas" usa TC de la factura; la diferencia entre ambas debe mostrarse como "Diferencia por devengado" en un pie de tabla.
- **B2 · Proyección de Facturación**: excluir embarques `Cancelado` explícitamente en el service; agregar "Confiabilidad" (facturado real ÷ proyectado del mes cerrado anterior) como badge junto al 56%.
- **B3 · KPIs faltantes en Dashboard Ejecutivo**: burn rate mensual, días cartera (DSO), días CxP (DPO), cobertura de gastos fijos = saldo bancos ÷ gastos fijos promedio. Un CFO los va a pedir en la primera reunión.
- **B4 · Presupuesto vs Real — categorías fantasma**: si hay gasto real en una categoría sin presupuesto capturado, mostrarla en la tabla con presupuesto "—" y variación 100%. Hoy simplemente no aparece.
- **B5 · Mapeo de "Comisiones" por nombre**: reemplazar el match por `nombre ILIKE 'comisiones'` por un flag `es_comisiones BOOLEAN` en `categoria_presupuesto` (migración) para que el usuario pueda renombrar sin romper el reporte.

---

## Fase 4 — UI/UX y navegación

- **C1 · Sub-navegación horizontal Profit**: hoy sólo llegas por breadcrumb. Agregar tabs `Dashboard · Proyección · Estado de Resultados · Presupuesto` bajo el header, con `usePeriodoMesUrl` compartido para que el mes se propague al cambiar de tab.
- **C2 · Consistencia del selector de mes**: EERR y Proyección tienen chevrons + dropdown; Presupuesto tiene chevrons + año, sin mes. Unificar el `MonthPicker`.
- **C3 · Empty states**: Presupuesto muestra tabla vacía sin CTA. Cuando no hay filas, mostrar "Aún no capturas presupuesto — [Copiar del año anterior]".
- **C4 · Deltas y micro-tendencias**: en el Dashboard, cada KPI debe mostrar Δ vs mes anterior (ya avanzamos con `ingresos_delta_pct`; falta desplegarlo visualmente en tarjetas).
- **C5 · Drilldowns**: click en cualquier fila de EERR abre `BudgetOverrunSheet`-style con desglose por embarque.
- **C6 · Exportar PDF del Dashboard**: el botón existe pero está desactivado. Implementarlo o esconderlo.

---

## Fase 5 — Producción

- **D1 · Guardrails multi-tenant**: script que audita todo `src/features/profit/**`, `presupuesto/**`, `tesoreria/**` — cada `.select()` debe tener `.eq("organization_id", ...)` explícito. Fallar CI.
- **D2 · Tests de humo E2E Profit**: spec Playwright que loguea admin, visita las 4 rutas, y falla si aparece cualquier `ErrorStateInline`.
- **D3 · Sentry breadcrumbs**: envolver hooks de Profit con `Sentry.startSpan` para diagnosticar performance en cliente real.

---

## Detalle técnico

```text
Files a tocar en Fase 2 (BLOCKER):
  src/features/presupuesto/services/vsReal.ts               (línea 53: drop .is deleted_at)
  src/features/presupuesto/services/__tests__/vsReal.*.ts   (agregar test regresión)
  scripts/lint-schema-columns.ts                             (nuevo: audita .is("deleted_at"))
  package.json                                               (nuevo script "lint:schema")
  .github/workflows/*.yml                                    (agregar step lint:schema)

Fase 3–5 se planean en detalle tras leer el reporte del subagente sub_4bj3qdpw.
```

---

## Orden de ejecución sugerido

1. Fase 2 completa (2 ediciones + 1 test + 1 script + 1 workflow) → v13.300.42.
2. Esperar reporte del subagente y priorizar B1–B5.
3. Fase 3 en 2 batches (B1+B2 primero, luego B3–B5) → v13.300.43-44.
4. Fase 4 (UI/UX) → v13.300.45.
5. Fase 5 (producción) → v13.300.46 → listo para publish.

¿Aprobamos y arranco por Fase 2?
