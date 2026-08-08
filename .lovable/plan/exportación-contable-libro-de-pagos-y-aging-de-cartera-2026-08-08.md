# Exportación contable: Libro de pagos y Aging de cartera

Objetivo: que el contador pueda bajar en CSV y PDF (1) el libro de pagos y (2) el Aging de cartera completa (por cobrar + por pagar), con los totales en pesos y el tipo de cambio del DOF a la vista.

## 1. Libro de pagos (Tesorería → Pagos)

Ya exporta CSV y PDF. Se le agrega la trazabilidad del tipo de cambio, manteniendo el TC con el que se registró cada pago (así el reporte cuadra con lo asentado en tesorería y con el banco):

- Columnas nuevas: **Tipo de cambio** y **Fuente del TC** (DOF de la fecha de pago cuando el pago se capturó con el TC oficial; "Registrado" cuando se capturó manualmente).
- Pie del reporte con el total en MXN de cobros, de pagos y el neto, más el conteo de pagos.
- El encabezado del PDF indica el periodo y la leyenda "Importes en MXN valuados al TC de cada pago".

## 2. Aging de cartera (CxC + CxP)

Hoy existe un "Reporte PDF" de cartera desde Facturas de proveedor, sin versión CSV y con los saldos en USD y MXN en columnas separadas sin convertir. Se convierte en un reporte contable único:

- Nueva pantalla **Reportes → Cartera y antigüedad**, con fecha de corte (por defecto hoy), filtro de cliente/proveedor y botones **Exportar CSV** y **Exportar PDF**. Se mantiene el botón actual en Facturas de proveedor, que lleva a esta pantalla.
- Buckets: por vencer, 1–30, 31–60, 61–90, +90 días, calculados contra la fecha de corte.
- Cada factura muestra, en columnas separadas:
  - **Saldo** en su moneda original.
  - **MXN histórico**: saldo por el TC con el que se registró la factura.
  - **MXN al corte**: saldo por el TC DOF de la fecha de corte.
  - **Diferencia cambiaria**: MXN al corte menos MXN histórico.
- Totales por bucket y gran total de cada bloque (CxC y CxP), con los tres importes en MXN y la diferencia.
- Encabezado con la fecha de corte, el TC DOF USD/MXN usado y su fecha de publicación. Si el DOF de ese día aún no se publicó, se usa el último publicado y se aclara con la fecha real (misma regla que ya usa el resto del ERP).
- El CSV trae una fila por factura más las filas de totales, con los importes en número plano (sin símbolo) para que se puedan sumar en Excel.

## 3. Detalles técnicos

- Aging: nuevo feature `src/features/reportes/cartera/` con dominio puro (`agingCartera.ts`: buckets, valuación histórica/al corte, totales), servicio de exportación (`carteraExport.ts`) y ruta `ReportesCartera.tsx`. Reutiliza `fetchCobranza` (trae `tipo_cambio`) y `fetchFacturasCxP` (trae `tipo_cambio_usd`); no se requieren cambios en la base de datos.
- TC del corte: se resuelve con el servicio existente de `tipos_cambio_dof` (`fetchTcDofVigente`), respetando la regla de "último publicado" cuando no hay dato del día.
- PDF: se reescribe `ReporteCarteraDocument` para recibir filas ya calculadas y formateadas (contrato local, sin depender del feature) y se sigue cargando con import dinámico para no engordar el bundle.
- CSV: `toCsv` + `downloadCsvWithFeedback`, igual que el resto del ERP.
- Libro de pagos: se extienden `filasLibroPagosExport`, `ENCABEZADOS_LIBRO_PAGOS` y `LibroPagosDocument` con TC y fuente; el pie usa los totales que ya calcula `libro_pagos`.
- Navegación y permisos: se registra la ruta en `routes.ts`, `appRoutes.lazy.ts`, `roleRouteMatrix.ts` y `sidebarItems.ts`, visible para contador, tesorero, gerencia y admin.
- Pruebas unitarias del dominio de aging (buckets, valuación, diferencia cambiaria, totales) y de las filas del CSV.
- Se registra la versión nueva en `CHANGELOG.md` y se sube `APP_VERSION`.
