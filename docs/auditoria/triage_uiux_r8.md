# Triage UI/UX R8 — validación de hallazgos WAVE 1

Fecha: 2026-08-04 · Entorno: preview local (`localhost:8080`) · Sesión: hector@lopezbenavides.com (Administrador, org Elogistix) · Resolución: 1920x1080 (Playwright/Chromium).

Objetivo: confirmar cuáles hallazgos del plan `instruccion_lovable_uiux_v1` son bugs reales antes de cambiar código.

## Resumen de veredictos

| Hallazgo | Veredicto | Evidencia |
|---|---|---|
| FIX 1 — Falta manejo de error/timeout en rutas | **REAL (parcial)** | `AsyncBoundary` sólo se usa en 6 rutas (Tesorería, Cartera, Configuración, Wizard de embarque, Conciliación bancaria, Detalle de factura). `/embarques`, `/facturacion` y `/usuarios` no lo usan. |
| FIX 2 — Cargas de 40–85 s / skeleton infinito | **NO REPRODUCIBLE** | Tiempos hasta contenido real: `/inicio` 3.7 s, `/embarques` 4.3 s, `/facturacion` 4.5 s, `/usuarios` 7.9 s, `/configuracion` 3.0 s, `/cartera` 3.2 s, `/cotizaciones/nueva` 3.6 s. Sin errores en consola. |
| FIX 3 — Búsqueda global incompleta / errores silenciados | **NO REPRODUCIBLE (funcional)** | `Ctrl+K`: "ELIMP003" → 10 resultados, "Indimex" → 17 (clientes, facturas, embarques), "A-1" y "FP-" → facturas de proveedor con folio interno, "ELIMP00349" → embarque + proforma. Pendiente sólo el manejo de error de red (no observado). |
| FIX 4 — Dashboard con datos en cero / saludo genérico | **NO REPRODUCIBLE, salvo un detalle** | `/inicio` muestra "Buenas tardes, Hector", fecha en formato mexicano, pipeline con datos (11/26/15/7/11/14/18), arribos, alertas y cargas por cliente. Detalle real: una alerta de demora muestra badge **"0d"**, que no comunica nada al usuario. |
| FIX 5 — No se puede registrar cobro desde CxC | **NO REPRODUCIBLE** | Detalle F960: botón **"Registrar pago"** visible, pestaña "Cobros", KPIs Total / Cobrado / Pendiente / Vence el. |
| FIX 6 — Tracking sin forma de registrar evento | **NO REPRODUCIBLE** | Tab Tracking de ELIMP00359: stepper de avance, "Copiar BL Master", "Abrir tracking de COSCO Shipping Lines", botón **"Registrar Evento"** y línea de tiempo. |
| FIX 7 — `/usuarios` roto o vacío | **NO REPRODUCIBLE** | 9 de 9 usuarios, filtros por rol y estado, selector de rol por fila, alta de usuario. |

## Hallazgos nuevos detectados durante la validación

1. **KPIs "Facturado mes" y "Cobrado mes" en MXN 0** en `/facturacion`, mientras la gráfica de tendencia de los últimos 6 meses sí tiene barras y hay 40 facturas por cobrar. Requiere verificar el filtro de mes/moneda del KPI (sospecha, no confirmado).
2. **Glifo faltante en el saludo del dashboard** (se muestra un cuadro en lugar del emoji) y en el texto de ayuda del tab Tracking.
3. **Badge de demora "0d"** en Alertas de Demora: mostrar "hoy" o suprimir la alerta cuando son 0 días.
4. **Etiqueta "Por cobrar" duplicada** (KPI y pestaña) en `/facturacion`; ambigua para el usuario y para pruebas automatizadas.

## Recomendación

Ejecutar sólo **FIX 1** del plan original (extender `AsyncBoundary` a las rutas sin protección) y abrir los 4 hallazgos nuevos como items menores. FIX 2 a FIX 7 se cierran como no reproducibles en la versión actual (v13.410.2).
