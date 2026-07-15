# Auditoría del módulo Profit — Hallazgos y plan de mejoras

Auditoría visual en Full HD (1920×1080) + revisión de código de las 4 vistas:
`/profit/dashboard` (Dashboard Ejecutivo), `/profit/proyeccion`, `/profit/estado-resultados`, `/profit/presupuesto`.

---

## Hallazgos clave (con evidencia)

### Bugs y riesgos (visibles al usuario)
1. **Dashboard: "Utilidad neta" = 99.8% de ingresos** — el KPI se llama "Utilidad neta" pero calcula utilidad operativa bruta sin restar gastos de admin/presupuesto (`alertas.ts:91`, `agregador.ts:87`). Un CFO lo lee mal.
2. **"Cartera vencida" mezcla vencida y corriente** — el KPI suma TODO `top_deudores`, mientras la alerta relacionada sí filtra `>30d` (`alertas.ts:97-100`). Card y alerta no cuadran entre sí.
3. **Preset "YTD" está roto** — dispara mes actual, no acumulado (`SelectorPeriodo.tsx:26`).
4. **Cifras no cuadran entre Dashboard y Estado de Resultados** — Dashboard usa fuente **devengada** (facturas), EERR abre por defecto en fuente **operativa** (ETA embarque). Un clic desde el KPI cambia los números sin aviso.
5. **Proyección no excluye embarques cancelados** (`fetchSources.ts:26-33`), pero EERR sí (`estadoResultados.ts:29`). Infla ingresos proyectados.
6. **Estado de Resultados: mismos conceptos duplicados** — "Flete Marítimo" aparece 2× en ingresos y 2× en costos con importes distintos; falta consolidar por concepto.
7. **Notas de crédito siempre caen en "Marítimo" con TC=1** (`estadoResultadosDevengado.ts:114-119`) — sesga el pivote por modo y en USD.
8. **Presupuesto vs Real: "% cumplimiento" siempre "—"** porque presupuesto=0 (captura vacía por default → primera experiencia rota).
9. **Presupuesto muestra Variación en rojo aunque presupuesto sea 0** — falso positivo visual.

### Seguridad y RLS
10. **`/profit/proyeccion` y `/profit/estado-resultados` sin `guarded(PROFIT_READ_ROLES, …)`** (`appRoutes.tsx:118-119`). Cualquier rol autenticado ve P&G y proyección completos.
11. **`fetchPresupuestoMensualAnio` no filtra por `organization_id`** explícitamente (`presupuesto/services/mensual.ts:10-21`) — inconsistente con el resto del módulo; depende sólo de RLS.

### Performance
12. **Dashboard: 14 llamadas al pipeline devengado por carga** (12m + actual + anterior en `agregador.ts:56-73`). Cambiar de mes re-descarga 11 meses idénticos.
13. **`vsReal.ts:33-50`: `.limit(2000)` / `.limit(500)` sin paginación** — trunca silenciosamente.

### UI/UX y consistencia
14. **4 selectores de periodo distintos** entre las 4 vistas (preset+sessionStorage, flechas+URL, año-only, MonthPicker). Sin sincronía al navegar.
15. **Terminología inconsistente** de "utilidad": Dashboard "Utilidad neta", Proyección "Profit", EERR "Utilidad bruta".
16. **Presupuesto: tabs Captura y Vs Real usan periodos distintos**; cambiar de tab pierde el mes.
17. **Filtros de Proyección** (cliente/operador/estado) no persisten en URL, sólo el mes.
18. **Cumplimiento presupuesto = 0% con badge "En rango"** — contradictorio.
19. **Saldos bancarios "Sin cuentas activas"** sin CTA para configurarlas.
20. **Sin loading en botón PDF**, permite doble clic.

### Datos que faltan (gaps de producto)
- Vista de **flujo de caja / cobrado** como tercera fuente además de operativa/devengada.
- **Comparativo histórico** (mismo mes año anterior, últimos 3/6m) dentro de cada vista, no sólo en el gráfico del Dashboard.
- **Forecast de cierre de mes** en Presupuesto (ritmo vs. días transcurridos) y de utilidad basado en pipeline.
- **Márgenes por cliente / ruta / agente** (hoy sólo por modo de transporte).
- **Desglose de IVA** — hoy `facturas.total` se usa sin desglosar (posible sobrestimación 16%).
- **Umbrales de alerta configurables** por organización (hoy hardcodeados en `alertas.ts:19-20`).
- **Auditoría de tipo de cambio** por fila (qué TC se aplicó).

---

## Plan de mejoras (por batches)

Cada batch es autocontenido, con cambios pequeños y verificables. Actualizo `APP_VERSION` y `CHANGELOG.md` al cierre de cada batch.

### Batch A — Seguridad y correctness (prioridad crítica)
- Envolver `/profit/proyeccion` y `/profit/estado-resultados` en `guarded(PROFIT_READ_ROLES, …)`.
- Añadir `.eq("organization_id", organizationId)` explícito en `fetchPresupuestoMensualAnio`.
- Añadir `.neq("estado", "Cancelado")` a `fetchSources.ts` de Proyección (alinear con EERR).
- Renombrar KPI **"Utilidad neta" → "Utilidad operativa"** en Dashboard, o restar `presupuesto.total_real_mxn` para que sea realmente neta (elegir 1; recomiendo renombrar + tooltip explicando alcance).
- Corregir "Cartera vencida": filtrar `dias > 30` como la alerta, o renombrar a "Cartera total por cobrar".
- Deshabilitar / arreglar preset **YTD** en `SelectorPeriodo` (si no soporta rango, ocultar).

### Batch B — Consistencia entre vistas
- Extraer **selector de periodo unificado** (`ProfitPeriodPicker`) usado por las 4 vistas, con estado en URL `?mes=YYYY-MM` + sessionStorage como fallback.
- Sincronizar periodo entre tabs Captura/Vs Real de Presupuesto.
- Unificar terminología: `Utilidad operativa`, `Utilidad neta`, `Margen operativo`, `Profit` (mismo diccionario en las 4 vistas).
- Persistir filtros de Proyección en URL (cliente/operador/estado).

### Batch C — Fixes visuales UI/UX
- Presupuesto vs Real: si `presupuesto==0` mostrar variación en gris/neutro (no rojo) y `%cumplimiento` como "Sin presupuesto capturado" con CTA a tab Captura.
- Cumplimiento 0% no debe decir "En rango"; usar estado `"Sin presupuesto"` cuando total=0.
- Loading state en botón PDF (spinner + `disabled` mientras genera).
- EERR: agrupar conceptos duplicados por nombre normalizado antes de renderizar; sumar y mostrar 1 fila por concepto.
- Empty state del Dashboard cuando `data` existe pero todos los arrays vacíos.
- CTA "Configurar cuentas" en card "Saldos bancarios" cuando no hay cuentas activas.

### Batch D — Performance
- Batchear los 12 meses de `eerr12m` en una sola consulta agregada por mes (nueva RPC o query con `group by month` sobre facturas/CxP) — reduce 14→2 roundtrips en carga inicial del Dashboard.
- Paginación real en `vsReal.ts` (o cursor) reemplazando `.limit(2000)`.

### Batch E — Data quality y drill-downs
- Notas de crédito: heredar `modo` y `tipo_cambio` del embarque de la factura original.
- Drill-down desde KPIs conservando periodo (`nav("/facturacion?estado=vencido&min_dias=30&mes=...")`).
- Nota metodológica corta en Dashboard, Proyección y Presupuesto (hoy sólo EERR la tiene).

### Batch F — Producto (nuevas capacidades)
> Sólo tras aprobación explícita; cambios de mayor alcance.
- Tercera fuente **Flujo de caja** en EERR (basada en fechas de cobro).
- **Forecast de cierre** en Presupuesto (ritmo vs. días transcurridos) y en Proyección (basado en pipeline de proformas abiertas).
- **Margen por cliente / ruta** (nuevo pivote en EERR).
- **Umbrales de alerta configurables** por organización (mover constantes de `alertas.ts` a `configuracion`).

---

## Ejecución sugerida

Recomiendo empezar por **A + C** (impacto directo al usuario, riesgo bajo, ~1 iteración), después **B** (selector unificado que arrastra a las 4 vistas) y luego **D/E/F** según prioridad del negocio.

Los batches F son cambios de producto de mayor alcance; pídeme cuáles quieres priorizar cuando lleguemos ahí.

---

## Detalles técnicos

- Archivos principales: `src/features/dashboardEjecutivo/services/{agregador,alertas}.ts`, `src/features/facturacion/domain/proyeccionFacturacion.ts` + `services/fetchSources.ts`, `src/features/profit/services/{estadoResultados,estadoResultadosDevengado}.ts`, `src/features/presupuesto/services/{mensual,vsReal}.ts`, `src/routes/appRoutes.tsx`.
- Guardar tests: los cambios de fórmulas (KPIs, filtros de cartera) deben venir con test en `src/features/**/__tests__/`.
- Sin migraciones en A–E. F puede requerir migración (columnas de configuración de umbrales).
