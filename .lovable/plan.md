## Diagnóstico

Hoy en el dashboard del portal del cliente (`/portal`), el KPI **"Cotizaciones"** muestra `cotizaciones.length`, es decir, todas las cotizaciones visibles del cliente: **Enviada + Aceptada + Rechazada + En operación**. Eso no representa "pendientes de interacción".

Las únicas cotizaciones que realmente requieren acción del cliente son las que están en estado **`Enviada`** (esperan ser Aceptadas o Rechazadas). El resto ya tuvo decisión o ya está operada.

## Respuesta a tu pregunta

Sí. El contador del card **debe contar únicamente las cotizaciones en estado `Enviada`**, porque son las únicas con interacción pendiente del cliente.

- `Aceptada` → ya decidió.
- `Rechazada` → ya decidió.
- `En operación` → ya pasó a embarque, no requiere acción.

## Plan de cambio

1. **Renombrar el label del KPI** en `PortalKpiGrid.tsx`:
   - De **"Cotizaciones"** → **"Cotizaciones Pendientes"**, alineado con el patrón ya usado en "Facturas Pendientes". Refuerza que el número representa acción pendiente, no inventario total.

2. **Cambiar el cálculo** en `PortalDashboard.tsx`:
   - Reemplazar `cotizaciones: cotizaciones.length`
   - Por: `cotizaciones: cotizaciones.filter(c => c.estado === "Enviada").length`

3. **Sin cambios** en la página `/portal/cotizaciones`: ahí el cliente sí debe poder ver el listado completo (incluyendo Aceptada, Rechazada, En operación) para consultar histórico. Solo cambia el contador del card del dashboard.

4. **Changelog**: agregar entrada nueva al inicio de `src/content/changelog/v8/chunks/0.ts` documentando el ajuste.

## Resultado esperado

```text
Card del dashboard del portal:
  "Cotizaciones Pendientes" → solo cuenta Enviada
  Click → lleva a /portal/cotizaciones (listado completo sin cambios)
```