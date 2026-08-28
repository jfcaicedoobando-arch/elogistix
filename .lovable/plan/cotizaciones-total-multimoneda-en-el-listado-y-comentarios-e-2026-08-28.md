# Cotizaciones: total multimoneda en el listado y comentarios en el PDF

Ambas observaciones son bugs reales y ya quedaron confirmadas contra los datos de COT-2026-0217 y COT-2026-0218.

## 1. El listado sólo muestra el importe en MXN

Qué pasa hoy: la columna "Subtotal" del listado lee las columnas `subtotal` + `moneda` de la cotización, que guardan un solo monto y una sola moneda. En la COT-217 esas columnas valen 81,700 MXN (Cargos Destino + Servicios Profesionales), y los 7,550 USD de Flete y Cargos Origen simplemente no se ven. Es como sumar la mitad del carrito porque el otro medio está en otra caja.

Qué haremos:
- Traer `conceptos_venta` en la consulta del listado.
- Calcular el subtotal por moneda a partir de los conceptos y mostrar en la celda ambos importes cuando existan (ej. `USD 7,550.00` + `MXN 81,700.00`), uno debajo del otro; con una sola moneda se ve igual que hoy.
- Conservar el orden actual: se sigue ordenando por el equivalente en MXN (ahora sumando las dos monedas con el T/C vigente), con tooltip "Ordenado por equivalente en MXN".
- Mismo tratamiento en la tarjeta móvil del listado para que coincidan.

No se cambia nada de cómo se guardan los totales en la base; sólo la presentación.

## 2. Los comentarios no salen en el PDF

Qué pasa hoy: los comentarios se capturan en el paso de costos (tabla `cotizacion_costos.notas`) — ahí están, por ejemplo, "Flete terrestre Manzanillo - Juárez…" en Servicios Profesionales de Logística. Cuando el wizard genera los conceptos de venta a partir de esos costos, copia descripción, cantidad, precio, IVA y clave SAT, pero **no copia las notas**. El PDF sí sabe imprimir notas (ya imprime la del Flete Internacional de la COT-217, que se capturó directo en el concepto), pero no recibe las de los costos.

Qué haremos:
- Propagar `notas` del costo al concepto de venta al generarlos (USD y MXN).
- Verificar que el campo de notas del concepto siga siendo editable y que gane el texto escrito manualmente si difiere del costo.
- El PDF no requiere cambios: la nota aparece como línea "↳" bajo el concepto.
- Cotizaciones ya guardadas (217, 218 y similares): al volver a guardarlas los comentarios se copian solos. Si prefieres, agrego un relleno único que copie las notas de costos a conceptos en las cotizaciones existentes que coincidan en descripción y moneda; dime si lo incluyo.

## Detalles técnicos

- `src/features/cotizacion/services/queries.ts`: agregar `conceptos_venta` a `COTIZACION_LIST_COLUMNS`.
- Nuevo helper puro `subtotalesPorMoneda(conceptos)` en `src/features/cotizacion/domain/` + tests.
- `cotizacionesColumns.tsx`: celda de subtotal multimoneda; `normalizarSubtotalMxn` recibe la suma de ambas monedas.
- `CotizacionMobileCard.tsx`: mismo render de importes.
- `src/features/cotizacion/domain/cotizacion.conceptos.ts`: `ConceptoVentaPrellenado` gana `notas?: string` y `buildConceptosFromCostos` lo copia desde `FilaCostoLocal.notas`; actualizar tests existentes.
- Sin cambios de esquema ni de RPC; bump de `APP_VERSION` y entrada en `CHANGELOG.md`.
