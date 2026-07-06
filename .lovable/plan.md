## Diagnóstico

El enlace de "Proforma origen" en `FacturaResumenCard.tsx` apunta a `/facturacion?proforma={id}` (query string sobre la lista de facturación), pero la ruta real del detalle de proforma es `/proformas/:id`. Por eso te lleva a la bandeja de facturación en lugar de abrir la proforma.

## Cambio

`src/features/facturacion/components/detalle/FacturaResumenCard.tsx` línea 52: cambiar el `to` del `<Link>` a `/proformas/${factura.proforma_id}`.

Bump `APP_VERSION` a `13.205.11` y entrada en `CHANGELOG.md`.

## Fuera de alcance

- No se toca la ruta ni ningún otro enlace.
- No se agrega breadcrumb ni preserva estado extra.
