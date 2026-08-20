# Ola 2 — Cerrar los candados que quedaron abiertos

Objetivo: los fixes visuales previos ya existen, pero varios módulos siguen fuera del candado (test/guardrail) y por eso la deriva puede regresar. Analogía: ya pusimos las cerraduras, faltan las llaves y cerrar las puertas que quedaron entreabiertas.

## Estado verificado hoy

| Punto | Situación real |
|---|---|
| 2.1 Charts | `ChartTooltip` existe y tiene test unitario, pero **no** hay guardrail que prohíba `<Tooltip>` de recharts suelto. Faltan 3 migraciones: `src/features/dashboard/direccion/components/RentabilidadSection.tsx`, `HealthTimelineChart.tsx`, `HealthTopErrorsChart.tsx` |
| 2.2 Badges | `status-badge-domains.test.ts` sólo cubre 4 archivos. Siguen con clases `bg-*/15` a mano: `TarifaEstadoUnificado`, `CartaGarantiaIndicator`, `TarifaFila`, `NcSatBadge`, `DetallePagoSheet.parts` |
| 2.3 Portal | 4 rutas sin `PortalPageShell`: `PortalDashboard`, `PortalEmbarqueDetalle`, `PortalFacturaDetalle`, `PortalCotizacionDetalle`. Además botones `h-6 px-2 text-2xs` en `PortalFacturaPagosCard` |
| 2.4 Tipografía | `MODULOS_MIGRADOS` = embarques, facturacion, tesoreria. `text-xs` global: 940 (portal 52, crm 73, dashboardEjecutivo 2) |

## 2.1 — Charts bajo un solo tooltip

- Migrar los 3 gráficos restantes a `ChartTooltip` (quitar `contentStyle`, `labelStyle` y formateadores ad-hoc).
- Nuevo guardrail `src/__tests__/architecture/chart-tooltip.test.ts`: ningún `.tsx` de `src/features` puede usar `<Tooltip` importado de `recharts` sin `ChartTooltip` como `content`; también prohíbe `contentStyle`.

## 2.2 — Badges de estado sin colores a mano

- Registrar los estados faltantes en el registro de estados y migrar los 5 archivos a `StatusBadge`, conservando textos e iconos actuales (Vigente / Cancelado / No encontrado / Pendiente / Rechazada / Vencida / Mejor opción / Carta garantía).
- Extender `MIGRADOS` en `status-badge-domains.test.ts` con esos 5 archivos.

## 2.3 — Portal completo y táctil

- Envolver las 4 rutas faltantes en `PortalPageShell` (título, migas y contenedor iguales al resto), sin cambiar sus datos ni consultas.
- Botones de descarga REP en `PortalFacturaPagosCard`: `size="sm"` estándar en lugar de `h-6 px-2 text-2xs`.
- Sustituir `text-2xs` de datos clave (Origen/Destino/ETD/ETA en `PortalEmbarqueDetalle`, montos en `PortalFacturas`/`PortalCotizacionCard`) por la escala semántica `text-label`.

## 2.4 — Tipografía semántica en portal, crm y dashboard

- Migración mecánica `text-xs` → `text-label` y `text-sm` → `text-body` / `text-body-sm` en `src/features/portal`, `src/features/crm` y `src/features/dashboardEjecutivo`.
- Agregar esos 3 módulos a `MODULOS_MIGRADOS` para que el candado quede puesto.

## Criterios de aceptación

- 0 `contentStyle` en gráficas; guardrail de charts en verde.
- 0 clases `bg-*/15` de estado en los 5 archivos; test de badges cubre 9 archivos.
- 9/9 rutas del portal con shell; sin controles por debajo del mínimo táctil.
- `text-xs` global baja de 940 a menos de ~420 y el test cubre 6 módulos.

## Detalles técnicos

- Sólo capa de presentación: nada de RPCs, servicios ni lógica financiera.
- Únicamente tokens semánticos; sin colores literales ni `style={{...}}`.
- Verificación: `bun run lint`, `bunx tsgo --noEmit`, `audit:arch`, `audit:tests` y los tests de arquitectura afectados; captura móvil del portal con Playwright.
- Cierre: entrada en `CHANGELOG.md` y `APP_VERSION` → `13.695.0`.
