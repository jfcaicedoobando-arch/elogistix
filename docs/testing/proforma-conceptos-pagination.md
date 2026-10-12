# Conceptos de proforma desde la segunda hoja

La proforma individual reserva la primera hoja para identidad, cliente, embarque
y condiciones de pago. El bloque de conceptos comienza en una hoja nueva,
normalmente la segunda. Si los datos de cabecera son excepcionalmente extensos,
pueden continuar sin recortarse antes del inicio del detalle.

El salto explícito está en `ProformaDocument`, antes de ambas secciones de
moneda. El bloque sigue siendo divisible: una lista larga puede ocupar tantas
hojas como necesite, con los encabezados de tabla y los pies existentes. Las
filas ordinarias conservan su protección contra cortes. Se mantiene la salida
segura existente para una descripción demasiado alta para una hoja completa.
No se cambian importes, tasas, notas, condiciones de pago ni la leyenda fiscal.

## Validación

- `tests/pdf/proformaConceptosPagination.test.tsx` reproduce los tres conceptos
  ficticios de PRO-2026-0030: los tres, las notas y el total de MXN 57,652.00
  quedan juntos en la segunda hoja; ningún concepto ocupa la primera.
- Una lista de 55 filas verifica inicio/final de cada fila en la misma página,
  ausencia de duplicación y espacio antes del pie de página.
- Las suites de notas, tokens extensos y totales siguen verificando geometría,
  texto íntegro, monedas separadas y ausencia de mutaciones de entrada.
- Los casos cortos que antes cabían en una hoja esperan ahora dos, según el
  nuevo diseño. No se reduce la tipografía ni se compacta la tabla.

Ejecutar `bun run test:pdf` con Poppler disponible y revisar los PDF generados
bajo `reports/pdf-smoke`.
