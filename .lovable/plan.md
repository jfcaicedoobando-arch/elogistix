## Problema

En el listado de **Mis cotizaciones**, COT-2026-0007 muestra el badge verde **"En operación · ELGEN00054"** que lleva al embarque. Pero al entrar al detalle de la cotización, ese enlace desaparece.

## Causa

La cotización está en estado **"Aceptada"** (no "Embarcada"), pero ya tiene `embarque_id` vinculado por el trigger de sincronización.

- **Listado** (`PortalCotizaciones.tsx`): muestra el badge siempre que exista `embarque_id` → funciona.
- **Detalle** (`PortalCotizacionEstadoBanner.tsx`): solo muestra el botón "Ver embarque" si `estado === "Embarcada"` → no aparece para "Aceptada".

El estado "Embarcada" probablemente solo se aplica en transiciones más tardías (o no se usa), por lo que la mayoría de cotizaciones convertidas quedan en "Aceptada" con `embarque_id`. Esto deja al cliente sin acceso desde el detalle.

## Solución

Unificar el criterio del listado y el detalle: **si hay `embarque_id`, mostrar el aviso de operación con el botón "Ver embarque"**, sin importar si el estado es "Aceptada" o "Embarcada".

### Cambios

1. **`src/components/portal/cotizacion/PortalCotizacionEstadoBanner.tsx`**
   - Quitar la condición `estado === "Embarcada"` para el bloque del banner verde con "Ver embarque".
   - Mostrarlo cuando exista `embarqueId` (independiente del estado).
   - Para "Aceptada" sin embarque, mantener el banner actual ("Te notificaremos cuando inicie la operación").
   - Para "Aceptada" con embarque, prevalece el banner de operación (mostrar también el comentario del cliente si existe).

2. **Changelog (`src/pages/Changelog.tsx`)**
   - Nueva entrada patch v8.99.5: "Portal: el detalle de cotización ahora muestra el enlace al embarque vinculado, igual que el listado."

No se requieren cambios de base de datos ni de servicios — los datos ya están disponibles en `fetchPortalCotizacion`.
