# Auditoría Profit — Fase 4

Dos subagentes revisaron el módulo. Los hallazgos convergen en cinco temas: **integridad multi-tenant**, **coherencia de cifras entre vistas**, **stale data**, **respuestas ejecutivas** (¿por qué bajó la utilidad?), y **consistencia visual**.

## Hallazgos clave (resumen)

Lógica de negocio (`sub_q6nzcp6z`):
- **CRITICAL 1** — `tesoreria/services/cuentas.ts`, `flujoProyectado.ts` (liquidaciones), `presupuesto/services/vsReal.ts` (proveedor_facturas, liquidaciones_comision) **no filtran por `organization_id`**. Multi-tenant contaminado.
- **CRITICAL 2** — `useUpdateEmbarque`, `useCreateEmbarque`, hooks de `conceptos_costo`/`conceptos_venta`, y mutaciones de `liquidaciones_comision` / `factura_notas_credito` **no llaman `invalidateProfitDependencies`** → EERR y Dashboard con datos viejos.
- **CRITICAL 3** — Dashboard usa siempre EERR devengado; página EERR permite alternar. Mismo periodo → totales distintos entre pantallas.
- **HIGH 4** — Devengado asigna `modo: "Marítimo"` por default cuando no hay embarque vinculado (infla marítimo).
- **HIGH 5** — `fetchSaldosCuentas` hace loop secuencial `for await` en lugar de `Promise.all` → N RTTs antes de calcular flujo.
- **HIGH 6** — `tipo_cambio ?? 1` silencia TC nulos convirtiendo USD/EUR a MXN 1:1.

UI/UX (`sub_tswyqaz2`):
- **CRITICAL 1** — Dashboard KPI "Margen 99.8%" vs 7.2% en EERR del mismo mes: incoherencia visible.
- **CRITICAL 2** — Ruta "Presupuesto vs Real" abre en tab "Captura" (no en "Vs Real").
- **CRITICAL 3** — Responder "¿por qué bajó la utilidad?" requiere 4-5 clics; no hay comparativo MoM/YoY por concepto o cliente.
- **HIGH 5** — Sin visibilidad de mix de moneda ni exposición cambiaria.
- **HIGH 6** — "Cartera vencida (>30d)" no separa >60/>90.
- **MEDIUM 10** — Presupuesto usa `MonthPickerMx`; el resto `PeriodoMensualToolbar`.

## Plan Fase 4 (dividido en batches G, H, I)

### Batch G — Integridad de datos (CRITICAL, prioridad máxima)

1. **Propagar `organization_id`** a los servicios huérfanos:
   - `tesoreria/services/cuentas.ts:fetchSaldosCuentas` acepta `orgId` y filtra `cuentas_bancarias`.
   - `tesoreria/services/flujoProyectado.ts:fetchLiquidacionesPendientes` filtra `liquidaciones_comision.organization_id`.
   - `presupuesto/services/vsReal.ts` filtra `proveedor_facturas` y `liquidaciones_comision` por org.
   - `dashboardEjecutivo/services/agregador.ts` propaga `organizationId` a cada llamada.
   - Agregar `deleted_at IS NULL` en `liquidaciones_comision` donde falte.

2. **Invalidaciones faltantes** (`invalidateProfitDependencies`) en:
   - `useUpdateEmbarque`, `useCreateEmbarque`, `useEliminarEmbarque`.
   - Hooks de `conceptos_costo` y `conceptos_venta` (crear/actualizar/eliminar).
   - Mutaciones de `factura_notas_credito` y `liquidaciones_comision`.

3. **Unificar fuente EERR entre Dashboard y página EERR**:
   - Dashboard respeta la fuente elegida por el usuario (persistida en `STORAGE_KEYS.eerrFuente`).
   - Badge visual persistente ("Fuente: Devengada" / "Operativa") en ambas vistas.

4. **TC nulo explícito**: reemplazar `?? 1` por función `convertirMoneda(monto, moneda, tc)` que lance/registre cuando TC falta; excluir esos montos del total y mostrar contador "N facturas sin TC" como alerta.

5. **Fallback modo "Marítimo"**: cambiar a `modo: "Sin asignar"` en devengado; agruparlo aparte en la vista para no inflar Marítimo.

6. **Paralelizar `fetchSaldosCuentas`** con `Promise.all`.

### Batch H — Respuestas ejecutivas (drill-down MoM/YoY)

7. **Fix ruta Presupuesto**: abrir directo en tab "Vs Real" (redirigir "Captura" a subruta).

8. **Comparativo MoM/YoY en EERR**:
   - Nueva columna "Δ vs mes anterior" y "Δ vs mismo mes año anterior" (monto y %).
   - Cálculo en el domain layer, un solo fetch adicional del periodo Y-1.

9. **Drill-down "utilidad → causa"** en Dashboard: sheet nuevo `UtilidadCausasSheet` que muestra top 5 clientes/conceptos con mayor variación negativa MoM.

10. **Top clientes por margen%**: nueva sección en Proyección de Facturación agrupando por cliente con ranking por margen.

11. **Cartera vencida por buckets**: separar 30-60 / 60-90 / >90 en el KPI y drill-down.

### Batch I — Consistencia visual y accionabilidad

12. **Unificar toolbars**: Presupuesto migra a `PeriodoMensualToolbar`; eliminar `MonthPickerMx` en esta vista.

13. **Alertas accionables**: título incluye monto (`"Saldo negativo el 15/ago: -$X MXN"`) y botón "Ver flujo".

14. **Mix de moneda visible**: badge de composición MXN/USD/EUR en ResumenCards del Dashboard.

15. **Badges severidad**: revisar tokens para que `critica` (rojo) y `warning` (ámbar) tengan contraste distinto claro.

## Tests de regresión

- `fetchSaldosCuentas.test.ts`: verifica filtro por org y paralelismo (mock con `Promise.all`).
- `vsReal.orgFilter.test.ts`: mock supabase confirma `.eq('organization_id', ...)`.
- `invalidateProfitDependencies.contract.test.ts`: extender para nuevas mutaciones.
- `estadoResultadosDevengado.sinTC.test.ts`: facturas sin TC no se convierten a MXN 1:1.
- `estadoResultados.modoSinAsignar.test.ts`: verifica nuevo fallback.
- `deltaMoM.test.ts`: cálculo puro de deltas mensuales/anuales.

## Alcance esta iteración

Batch G completo + tests de regresión (crítico para integridad de datos multi-tenant). H e I quedan para las siguientes fases una vez validado G.

- `APP_VERSION` → `13.300.36`.
- `CHANGELOG.md`: entrada resumida de Batch G.

## Detalles técnicos

- `organizationId` viene de `useOrgFilter()` en la capa hook; los servicios lo reciben como parámetro explícito para mantener servicios puros/testeables.
- El agregador ya recibe `organizationId` — solo hay que propagarlo hacia dentro.
- `invalidateProfitDependencies` ya existe en `src/features/profit/utils/`; solo agregar `queryClient.invalidateQueries` en los `onSuccess` faltantes.
- Cambios de dominio (modo "Sin asignar", TC nulo) son cambios de **contrato** — actualizar snapshots de tests existentes y tipos `EstadoResultados`.

## Fuera de alcance

- Rediseño visual mayor del Dashboard (queda para Fase 5 si el usuario lo pide).
- Migración de MonthPickerMx (Batch I).
- Nuevas vistas agregadas por cliente (Batch H).
