## Limpieza de columnas en tabla de Proformas (Pre-Facturación)

### Cambios
En `src/components/facturacion/proformasColumns.tsx`, eliminar las columnas:
- `bl_master` (BL Master)
- `tipo` (Individual / Consolidada)
- `dias_credito` (Días Crédito)
- `monto_usd` (Monto USD)
- `monto_mxn` (Monto MXN)
- `folio_factura` (Folio Factura)

### Columnas que quedan
`# Proforma`, `Expediente`, `Cliente`, `Operador`, `Fecha`, `Estado`, `Acciones`.

### Notas
- Solo afecta el tab **"2. Proformas"** de Pre-Facturación. No toca el tab **"1. Por aprobar"**, ni el histórico dentro del detalle de embarque (`HistorialProformas.tsx`), ni la exportación CSV (que sigue incluyendo todos los campos para contabilidad).
- No se modifica el esquema de BD ni los servicios; solo la presentación.
- Los botones de descarga de PDF/XML de la factura emitida dejan de mostrarse en esta tabla al quitar la columna Folio. Si más adelante los necesitas, podemos moverlos a la columna de Acciones.

### Versionado
- Bump `APP_VERSION` a **12.49.5**.
- Entrada en `CHANGELOG.md` describiendo la simplificación de columnas.