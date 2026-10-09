# Cotizaciones: utilidad basada en la venta vigente

## Contrato y alcance

La observación se reprodujo en COT-2026-0039 sobre la interfaz 13.824.54 y se rastreó en main `6c31909ccfaf7e7b41ae579f6b5f6690a43e77ca`. El resumen del paso 4 y del detalle mostraba USD 100 de venta y USD 50 de utilidad, aunque los conceptos vigentes eran USD 150 y una partida manual MXN 10,200. Los costos internos eran USD 50, cantidad 1. El guardado, la restauración del borrador y la regeneración selectiva conservaban correctamente los conceptos.

El contrato histórico de la barra consolidaba ventas y costos del costeo para excluir IVA. Después de permitir ajustes y partidas manuales en la cotización del cliente, esos importes presupuestados dejaron de representar la venta comercial vigente. La corrección mantiene la simulación en el paso 2 y utiliza la venta del cliente en el paso 3, el resumen del paso 4 y el resumen del detalle.

- Fuente de costo: los totales del costeo interno ya calculados, conservando su precisión por línea.
- Fuente de venta: cantidad por precio unitario de cada concepto cliente vigente, redondeado por línea con los auxiliares monetarios canónicos. Incluye partidas manuales, ajustes, duplicados legítimos y precio explícito cero. No añade la venta presupuestada otra vez.
- IVA: no participa en ingresos, costos o utilidad del resumen. No se usa el total con impuesto del concepto. Tratamientos 16%, 8%, 0%, exento y no objeto no cambian esa base.
- Monedas: USD y MXN permanecen separadas. No se agrega una conversión ni se usa un tipo de cambio supuesto. El TC 17 del ejemplo sigue siendo responsabilidad del encabezado mixto existente.
- Ausencia histórica de conceptos: conserva la estimación del costeo y muestra un aviso explícito. No hay fallback por moneda ni por importe cero.
- Captura incompleta, moneda no soportada o conceptos descartados por el parser: el resumen no publica métricas parciales ni sustituye los datos por el presupuesto.
- Sin desglose total de costos: solicita cargar los costos y no presenta un margen de 100%. Una partida manual en MXN sí participa cuando existe desglose de la cotización en USD; un costo registrado de cero sigue siendo válido.
- Venta cero: conserva la utilidad negativa correspondiente y muestra margen no calculable. No califica la rentabilidad global cuando una moneda activa carece de denominador.

El ejemplo queda en USD venta 150, costo 50, utilidad 100 y margen 66.67%; MXN venta 10,200, costo registrado 0 y utilidad 10,200. Se trata de utilidad contra los costos cotizados, no del resultado financiero realizado del embarque.

Los mapas y tablas editables de costos, la sincronización por linaje, la persistencia, las reglas fiscales y los documentos del cliente no cambian. El helper sólo produce datos de presentación; abrir o recalcular el resumen no escribe ni modifica conceptos o costos. PDF y listado ya consumen los conceptos del cliente y no requieren cambiar de fuente.

## Base y empaquetado

Candidato 13.824.56 sobre main `64f44e2007b3091f385b622d9c1f054d6d267b6f` (PR209). El cambio independiente de saldo pendiente de PR209 y su migración `20261009152000` quedan intactos. La entrada 56 del manifest repite las 1,512 migraciones de 55 y conserva literalmente las entradas históricas. No hay SQL nuevo ni cambios en esquema, roles, permisos o datos.

## Verificación

La prueba de interfaz del detalle falló antes de la corrección porque no encontraba la venta USD 150; el resumen aún mostraba USD 100. Después de la corrección, la matriz focalizada valida el helper, el paso 4, la barra, el detalle, la moneda manual, IVA, precio cero, redondeo, partidas duplicadas, datos inválidos y el fallback histórico. También se ejecutan las regresiones existentes de guardado con sello/CAS, cantidad fraccionaria, sincronización selectiva, restauración de borrador y finalización.

La comprobación TypeScript completa local terminó con código 137 por límite del entorno, sin diagnóstico de tipos; no se considera aprobada. El CI del commit exacto debe resolver TypeScript y los demás gates completos. No se realizó build de producción ni se alteró la cotización real de prueba durante este trabajo. La validación posterior en la interfaz publicada requiere que ésta tenga la nueva versión y debe volver a comprobar los valores del ejemplo, la conservación de las partidas y el flujo sin desglose.
