## Resumen ejecutivo

Auditamos las 4 vistas de Profit (Dashboard Ejecutivo, Proyección de Facturación, Estado de Resultados, Presupuesto vs Real) usando:
- Screenshots reales en Full HD de las 4 rutas.
- Sub-agente especialista de UX/UI que revisó los 4 archivos ruta + componentes.
- Sub-agente especialista de lógica de negocio (todavía completándose — sus hallazgos numéricos se sumarán al ejecutar).
- Revisión directa del código y de migraciones SQL.

**Veredicto: NO está listo para producción.** Hay 1 bug crítico que rompe por completo el Dashboard Ejecutivo, más 3 problemas HIGH y varias inconsistencias UX que restan credibilidad al módulo frente a un usuario final CFO.

Analogía: es como un tablero de coche con velocímetro roto (crash del dashboard), 3 indicadores sin luz de aviso (sin error state) y varias palancas donde deberían ir botones (inconsistencias UX). El motor funciona bien, pero el conductor no puede confiar en lo que ve.

---

## Bug bloqueador (encontrado en la captura visual)

**Dashboard Ejecutivo carga con error rojo en pantalla:**
```
Error al cargar el snapshot: column liquidaciones_comision.deleted_at does not exist
```

- Archivo: `src/features/tesoreria/services/flujoProyectado.ts:32`
- Filtramos `.is("deleted_at", null)` sobre `liquidaciones_comision`.
- Verifiqué las migraciones SQL: `liquidaciones_comision` **nunca** recibió la columna `deleted_at` (no está en el CREATE TABLE `20260602193937` ni en la migración de bulk-add `20260516191616`, que sí la agregó a otras 11 tablas).
- Impacto: **todo el Dashboard Ejecutivo revienta**; no se puede ver ningún KPI ni exportar el PDF ejecutivo.

**Fix mínimo (2 opciones — recomiendo la A):**
- **A.** Quitar `.is("deleted_at", null)` de `fetchLiquidacionesPendientes` (la tabla no tiene borrado lógico; ya se filtra por `fecha_pago IS NULL` que es el equivalente funcional).
- **B.** Agregar migración `ALTER TABLE public.liquidaciones_comision ADD COLUMN deleted_at timestamptz` + índice parcial. Más riesgoso porque cambia el modelo; no hay evidencia de que se necesite soft-delete ahí.

---

## Hallazgos por vista (severidad → problema → fix)

### 1) Dashboard Ejecutivo

1. **CRITICAL** — Crash por columna inexistente (arriba). Bloquea toda la vista.
2. **HIGH** — Error state genérico sin botón "Reintentar" (`ProfitDashboardEjecutivo.tsx:79-90`). Fix: componente `ErrorStateInline` con `refetch`.
3. **HIGH** — 6 KPIs en una fila con jerarquía plana (`BandaKPIs.tsx`). El CFO no distingue lo urgente ("cartera vencida" en rojo) de lo informativo ("saldo bancos"). Fix: variante destructive automática y tamaño diferenciado.
4. **MEDIUM** — Orden invertido de storytelling: Alertas queda debajo de gráficos históricos. Fix: subir `AlertasPanel` justo debajo de la banda de KPIs.
5. **MEDIUM** — Solo 2 de 6 KPIs muestran delta vs período anterior. Fix: agregar deltas o sparklines a "Saldo bancos", "CxP 7 días", "Cumplim. presupuesto".
6. **MEDIUM** — Horizonte de forecast hardcoded en 3 meses (`ForecastMultiMesChart.tsx:19`). Fix: selector 3/6/12 meses.
7. **LOW** — Tamaño de fuente de KPI varía por longitud del string (`KpiCard.tsx:47-50`), rompiendo alineación entre celdas.

### 2) Proyección de Facturación

8. **HIGH** — No hay manejo visible de `error` en `TabProyeccion.tsx`: si la query falla, se ve "sin datos", que confunde falla con ausencia real. Fix: exponer y renderizar `error`.
9. **MEDIUM** — Filtros (cliente/operador/estado) no persisten en URL, aunque el mes sí. Fix: `useSearchParams` para filtros.
10. **MEDIUM** — Emojis mezclados con íconos Lucide en `ProyeccionCierreSection.tsx:39-41` (`titulo="✓ Facturado"`). Fix: quitar emojis, dejar solo Lucide.
11. **MEDIUM** — Vive aislada de las otras 3 vistas Profit (sin cross-links). Fix: enlaces cruzados a EERR/Presupuesto del mismo mes.
12. **LOW** — "expedientes con ETA en {mes}" está oculto en mobile (`hidden md:block`).

### 3) Estado de Resultados

13. **HIGH** — No hay columna de comparación vs mes anterior ni vs presupuesto. El CFO tiene que saltar entre 3 pantallas para saber si el mes fue bueno. Fix: columna opcional "Δ vs mes anterior" o badge de "vs presupuesto".
14. **MEDIUM** — `SectionHeader` usa `colSpan={5}` hardcodeado (`EstadoResultadosTable.tsx:16-24`). Fix: derivar de `MODOS_COLUMNAS.length + 2`.
15. **MEDIUM** — Tabla 100% numérica sin gráfico de tendencia. Fix: mini-sparkline de evolución de margen arriba de la tabla.
16. **MEDIUM** — Nota de fuente (`Fuente operativa/Facturas`) en gris 11px, aunque cambia radicalmente los números. Fix: `Alert` sutil.
17. **LOW** — Duplica lógica de navegación de mes que ya vive en `PeriodoMensualToolbar` (Dashboard Ejecutivo). Fix: reutilizar.
18. **LOW** — Botones PDF/CSV sin loading/disabled (doble descarga posible).
19. **LOW** — Falta `<caption>` y `scope` en tabla desktop (accesibilidad).

### 4) Presupuesto vs Real

20. **HIGH** — No hay `error` state en ninguno de los 3 tabs; si `usePresupuestoVsReal` falla queda en skeleton infinito. Fix: rama de error visible + reintentar.
21. **MEDIUM** — Tab activo (`captura`/`vs-real`/`config`) no persiste en URL — inconsistente con el resto del módulo. Fix: `useSearchParams`.
22. **MEDIUM** — Cuando no hay presupuesto capturado, las 4 KPI cards muestran "$0.00" en vez de "—", leyéndose como "no se gastó nada". Fix: dash cuando `sinPresupuestoGlobal`.
23. **MEDIUM** — Sin drilldown por categoría. El usuario ve "excede 20%" pero no puede indagar qué facturas lo componen. Fix: click en fila → sheet con detalle.
24. **LOW** — `tono()` en `VsRealFila.tsx:14-18` con clases sueltas en vez del helper `getProfitToneClass` usado en Proyección. Fix: unificar.
25. **LOW** — Sin exportación CSV (las otras 3 vistas sí la tienen).
26. **LOW** — Tabla desktop sin variante mobile-card (a diferencia de Estado de Resultados).

### Transversal

27. **MEDIUM** — Las 4 vistas Profit no tienen sub-nav de módulo; cada una es una ruta aislada. Fix: tabs horizontales fijos en el layout de Profit.
28. **LOW** — Ningún KPI muestra "última actualización" — importante en finanzas para diferenciar realtime vs batch.

---

## Roadmap propuesto (4 fases)

**Fase 1 — Blockers de producción** (obligatoria antes de release)
- Fix del crash `deleted_at` en `liquidaciones_comision` (Bug crítico).
- Añadir `ErrorStateInline` con reintentar a las 4 vistas.
- Manejo explícito de `error` en `TabProyeccion` y `TabVsReal`.

**Fase 2 — UX financiera correcta**
- Comparativos vs mes anterior en todos los KPIs y en EERR.
- Alerts arriba en el Dashboard (jerarquía correcta).
- Estado "sin presupuesto" con "—" en vez de $0.00.
- Selector de horizonte de forecast (3/6/12m).
- Alert visible al cambiar fuente EERR/Presupuesto.

**Fase 3 — Cohesión del módulo**
- Sub-nav de tabs entre las 4 vistas.
- Persistencia en URL de tab activo (Presupuesto) y filtros (Proyección).
- Unificar `PeriodoMensualToolbar` en las 3 vistas que lo necesitan.
- Cross-links entre las 4 vistas del mismo período.

**Fase 4 — Pulido y accesibilidad**
- Drilldown por categoría en Presupuesto vs Real.
- Quitar emojis / homogeneizar iconografía.
- CSV en Presupuesto, loading/disabled en botones de export.
- `caption`/`scope` en tablas, gestión de foco en Sheets.
- Fix de `colSpan` hardcoded, tamaño de KPI consistente.
- Timestamp "última actualización" visible.

## Verificación

Para cada fase: `bun run lint` + `bunx vitest run` sobre servicios/componentes tocados, captura Playwright Full HD de las 4 vistas post-fix, y check visual con la misma cuenta admin usada en esta auditoría. Bump de `APP_VERSION` + entrada en `CHANGELOG.md` por fase (patch por fase).

## ¿Qué apruebas?

Sugiero empezar por **Fase 1** (bloqueador crítico + error states) en un solo build. Si prefieres, arrancamos con todo el roadmap secuencial hasta Fase 4. Dime cuál prefieres o si quieres priorizar algún hallazgo específico distinto.
