
## Objetivo

Entregarte la lista completa de las **179 proformas huérfanas** (marcadas como `facturada` pero sin factura enlazada ni folio externo) para que decidas caso por caso.

## Qué haré

1. Correr una consulta de lectura sobre `proformas` con los criterios ya validados:
   - `estado_proforma = 'facturada'`
   - `factura_id IS NULL`
   - `folio_factura_externa` vacío / nulo
   - Sin factura que apunte a la proforma (`facturas.proforma_id`)
   - `deleted_at IS NULL`
2. Exportar el resultado a CSV en `/mnt/documents/proformas-huerfanas.csv` con las columnas útiles para revisión:
   - `numero`, `cliente_nombre`, `expediente`, `moneda`, `total_usd`, `total_mxn`, `fecha_emision`, `dias_credito`, `operador`, `estado_cliente`, `estado_revision`, `created_at`, `id`
3. Ordenar por `created_at DESC` (más recientes primero).

## Lo que **no** cambia

- Cero cambios en base de datos.
- Cero cambios en código.
- Nada de UI ni versionado — es sólo un export para diagnóstico.

## Entregable

- Archivo CSV descargable en `/mnt/documents/proformas-huerfanas.csv`.
- Además pego en el chat un resumen (conteo por cliente Top 10 y por año) para que ubiques rápido patrones — típicamente los legacy vienen concentrados en pocos clientes.

## Analogía

Es como pedirle al archivo del banco la lista de todos los recibos con sello "pagado" que no tienen cheque ni transferencia atrás — te la damos impresa, tú decides qué hacer con cada uno.
