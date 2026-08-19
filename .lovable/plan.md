# Auditoría visual — plan de convergencia (Olas E a H)

Auditoría recibida: 82 hallazgos visuales (22 P1). Revisé el código antes de planear y **parte ya está resuelta** en olas anteriores; el plan sólo ataca lo que sigue vivo.

## Ya resuelto (no se vuelve a tocar)

- **V-3 (aging):** ya existe una escala única `--aging-1..5` y `facturacion/utils/aging.ts` la consume desde `lib/aging/buckets`.
- **V-18 (panel de alertas):** ya quedó en `border-warning/40 bg-warning/10` con `SectionHeading` y badge `size="xs"`.
- **V-4 (tooltips) parcial:** ya existe `ChartTooltip` compartido aplicado a 8 gráficas. Faltan las que la auditoría lista aparte: `GraficoEERR12m`, `ForecastMultiMesChart`, `MiniFlujoCard`, `AdminDashboardActivityChart`.
- **V-6 parcial:** los shells de portal y portal-agente sí usan `PageContainer` (el problema real son tamaños/tipografía dentro de las páginas, no el contenedor).

## Confirmado y pendiente

- Escala tipográfica semántica con **0 usos de `text-body`** en features (491 archivos con `text-sm`).
- `formatPercent` no existe; `formatFechaEs` sigue en 30 archivos junto a `formatDate`.
- Emojis en ~12 archivos de UI de negocio.
- 34 archivos con `<thead>` crudo fuera de `DataTable`.
- 302 archivos con `title=` nativo; 374 con `...` ASCII.

## Olas propuestas

### Ola E — Un solo lenguaje visual (mayor impacto)
1. **Tipografía (V-1):** migración por módulos, empezando por embarques, facturación y tesorería: `text-sm`→`text-body`, `text-xs` de celdas/labels→`text-body-sm`. Guardrail nuevo que impida reintroducir `text-sm`/`text-xs` en esos módulos.
2. **Badges de estado (V-2):** registrar en `statusRegistry` los dominios faltantes (pagos, movimientos bancarios, tarifas, carta garantía, NC SAT, CFDI) y migrar los 12 badges manuales a `<StatusBadge domain=…>`.
3. **Emojis (V-10):** reemplazar 🚢✈️🚛🎉📦⚠️✓✗ por iconos lucide (`ModoIcon`, `PartyPopper`, `AlertTriangle`, `Check`/`X`) y añadir guardrail anti-emoji en `.tsx`.
4. **Gráficas (V-4 cierre + VR-4):** aplicar `ChartTooltip` a las 4 gráficas restantes, unificar tamaño de ticks, radios de barra y colores de series/leyenda vía `chartTokens` (baja saturación).
5. **Formatters (V-14):** crear `formatPercent`, marcar `formatFechaEs` como deprecado con migración a `formatDate`, quitar `toFixed`/`$` inline de la UI (EmbarqueBadgeAdmin, ReportesTopChart, HeroCards) y guardrail contra `toFixed` en JSX.

### Ola F — Un solo esqueleto
6. **Empty states (V-9):** renombrar el duplicado de `VirtualTableParts` a `VirtualTableEmpty`, un único punto de importación y migrar los 3 improvisados.
7. **Loading (V-8):** un guard por ruta, consolidar skeletons en `shared/skeletons/` con prop de ancho y quitar el "Cargando registros…" en texto plano de admin.
8. **Tablas crudas (V-5, V-22):** migrar las 10 más visibles a `DataTable`/`DetailTable` con `TABLE_DENSITY` (flujo semanal de tesorería — la que corta la columna NETO —, FacturaPagosTabla, FacturaNotasCreditoTable, Cliente360Panel, EstadoResultadosTable, los 3 tabs de presupuesto, TabLiquidaciones, SaldosBancosCard).
9. **Anchos y tabs (V-13, V-12):** criterio único (listado con ≥6 columnas → `width="wide"`) y variante oficial `variant="underline"` en `ui/tabs` para facturación, CRM y dashboard ejecutivo.
10. **KPIs (V-7, V-20):** política única — `KpiCard` plano por defecto, color sólo para alarma, labels sin uppercase, grid estándar. Migrar HeroCards, LibroPagosKpis, EstadoCuentaResumen y quitar el "arcoíris" de ReportesKpiCards.

### Ola G — Cara pública y tesorería
11. **Portal (V-6):** subir botones de 24px al mínimo táctil (`h-8`), pasar datos clave de `text-2xs` a `text-body-sm`, badge de notificaciones legible, tipografía semántica en las 14 páginas.
12. **Auth/legal (V-19):** `AuthCard` y `LegalShell` compartidos (login, reset, unsubscribe, onboarding, sin-acceso, 404, legales).
13. **Tesorería (V-21):** cierre de convergencia del módulo (badges, tabla de flujo, empty, KPI strip, overline, formatter de fecha).

### Ola H — Micro-pulido y guardarraíles
14. V-23 a V-40: ellipsis `…`, sentence case en títulos, componente `Overline`, escala fija de anchos de filtros, `title=` → `<Tooltip>` en tablas, `size-4` en iconos, `gap-2` en botones, `Badge size="xs"`, `MargenBadge` compartido, chip de folio único, copy de exportar, paridad dark de softs de modo.
15. Guardarraíles CI acumulados de las olas anteriores.

## Pendientes de verificación antes de tocar código

- **VR-1 (overflow del hero de "Principal"):** `ArribosCard` ya usa `flex` responsivo con `min-w-0`; no pude reproducir el desbordamiento leyendo el código. Primer paso de la Ola F: capturar la vista a 1920px y sólo entonces decidir el fix.
- **VR-2 (columna "Cliente" vacía en Cotizaciones):** la consulta sí selecciona `cliente_nombre` y la columna lo lee. La auditoría corrió contra una base local con datos demo, así que la causa probable es dato faltante, no UI. Se revisa con una consulta a los datos reales antes de cambiar nada; si son datos, se reporta y no se toca código.

## Notas técnicas

- Todo es refactor de presentación: sin cambios de negocio, RLS ni migraciones (salvo que VR-2 resulte ser de datos, que se reportaría aparte).
- Cada ola cierra con `tsgo`, suite de tests, guardrails de arquitectura, bump de `APP_VERSION` y entrada en `CHANGELOG.md`.
- Las migraciones tipográficas se hacen por módulo y no por codemod global, para mantener los archivos bajo el límite de Power of 10 y permitir revisión.

¿Arrancamos por la Ola E?
