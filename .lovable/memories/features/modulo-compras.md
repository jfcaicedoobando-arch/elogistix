---
name: Alcance del módulo de compras
description: Rutas, sidebar y funcionalidades cubiertas por el "módulo de compras" tras el rediseño 13.175.0.
type: feature
---
El **módulo de Compras** vive unificado bajo `/compras/*`. La navegación entre sus páginas se hace exclusivamente por el sidebar (no hay tabstrip interno; `ComprasTabStrip` fue eliminado en 13.175.0).

Rutas del módulo:
- `/compras` — Dashboard (KPIs, aging resumen, top 5 proveedores con saldo, últimas facturas, quick-links).
- `/compras/por-capturar` — Embarques con presupuesto sin factura.
- `/compras/por-aprobar` — Redirige a `/compras/facturas?aprobacion=pendiente` (Ola C: bandeja dedicada).
- `/compras/por-pagar` — Facturas con saldo, para programar pagos.
- `/compras/facturas` — Listado principal de facturas de proveedor (antes `/cxp`).
- `/compras/pagos` — Listado global de pagos a proveedor (placeholder, Ola E).
- `/compras/notas-credito` — Listado global de NC de proveedor (placeholder, Ola E).
- `/compras/proveedores` y `/compras/proveedores/:id` — Catálogo y detalle.
- `/compras/aging` — Antigüedad de saldos (5 cubetas).
- `/compras/conciliacion` — Conciliación factura ↔ embarque (presupuesto vs facturado por embarque).
- `/compras/reportes` — Reportes analíticos (placeholder, Ola F).

Rutas legacy con redirect preservando querystring (via `RedirectPreserveSearch`):
- `/cxp` → `/compras/facturas`
- `/cxp/por-capturar` → `/compras/por-capturar`
- `/cxp/por-pagar` → `/compras/por-pagar`
- `/proveedores` → `/compras/proveedores`

Sidebar: la sección "Compras" (única fuente de verdad: `SIDEBAR_COMPRAS_ITEMS` en `sidebarItems.ts`) muestra los items filtrados por rol vía `filterCompras(urls)`. Ya NO existe duplicidad con Gestión ni con Directorio; Proveedores dejó de estar en Directorio y "Facturas de proveedor" dejó de estar en Gestión.

Al interpretar solicitudes de cambios en "compras", cubrir todo el módulo listado arriba.
