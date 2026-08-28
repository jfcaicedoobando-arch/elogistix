# Backlog QA · Olas E2 y E3 (23 bugs)

Los 13 bugs de esfuerzo E1 del documento ya quedaron cerrados en la versión 13.780.0, así que este plan cubre **E2 (12 bugs)** y **E3 (11 bugs)**. Se entrega en 5 sub-olas para poder revisar y publicar por partes.

Decisión de producto ya tomada (bug C9): **el vendedor puede ver costos y márgenes únicamente de las cotizaciones donde es el vendedor asignado.**

## Qué se confirmó revisando el sistema

- **N5** (tesorería): el disparador de consistencia de conciliación sólo se activa con 4 columnas viejas; los vínculos nuevos (anticipos, lotes de pago, traspasos) se editan sin validación. Confirmado en la base.
- **C3 residual**: `proveedor_facturas_conceptos`, `proveedor_notas_credito` y `anticipos_proveedor` no tienen el candado de "mismo tenant que el padre". Confirmado.
- **M2 residual**: el candado de tipo de cambio DOF en facturas es sólo al crear, no al cambiar de moneda. Confirmado.
- **C9**: la función de permiso de costos incluye hoy 14 roles (vendedor, operador, customer service…), muy por encima de lo que muestran los tableros. Confirmado.
- **N10** (retenciones): el prorrateo usa la base bruta de la factura y no descuenta notas de crédito ni asigna el residual de centavos. Confirmado.
- **N1 / N2** (complementos de pago al SAT): el saldo anterior se calcula sólo con pagos previos (ignora notas de crédito) y la tasa de IVA del documento relacionado se "adivina" con un promedio, eligiendo la tasa más cercana del catálogo. Confirmado en el código de la función de timbrado.
- **N9 / N27** (presupuestos): cualquier moneda distinta de MXN se valúa con el tipo de cambio de dólar, y el fin de mes se arma con fecha local. Confirmado.

Pendientes de verificar en su propio paso (no se afirma causa todavía): N26 (vigencia de enlaces de tracking), N15 (huérfanos al cancelar embarque), N7 (borrado lógico de factura emitida), N11 (tolerancia en conciliación manual), L3/L4, M5 residual, N18, N25, N19, N-F2, N14, N17, M1 residual.

## Sub-ola A · Tesorería y aislamiento (E2, prioridad alta)

- **N5**: recrear el disparador de consistencia con la lista completa de columnas de vínculo.
- **C3-res**: aplicar el candado genérico de "mismo tenant" a las 3 tablas de cuentas por pagar.
- **N11**: exigir que el movimiento bancario y el pago cuadren dentro de una tolerancia de centavos, en base de datos y en la pantalla de conciliación manual.
- **N7**: impedir el borrado lógico de una factura emitida con pagos o notas de crédito vivos.
- **N15**: al cancelar un embarque, bloquear también si tiene proformas vivas o facturas en borrador; cambiar el borrado en cascada de proformas por bloqueo.

## Sub-ola B · Facturación y permisos (E2)

- **M2-res**: el candado de tipo de cambio DOF se extiende al cambio de moneda en borrador (recalculando el tipo de cambio oficial).
- **C9**: la función de permiso de costos se alinea a la matriz de la aplicación; el vendedor sólo ve costos de sus propias cotizaciones y los roles sin necesidad de costo quedan fuera.
- **M5-res**: un evento de embarque no puede ser anterior a la creación del embarque (con excepción documentada para carga histórica).
- **N26**: vigencia máxima obligatoria para los enlaces públicos de tracking (sin enlaces eternos).
- **L4**: se elimina el cálculo muerto de IVA agregado y se fija por prueba el cálculo renglón por renglón.
- **L3**: la importación masiva reporta éxitos, fallos y detalle por lote en lugar de un "Error al importar".
- **N27**: fin de mes en presupuestos con el helper canónico de fechas.

## Sub-ola C · Complementos de pago al SAT (E3, lo más riesgoso fiscalmente)

- **N1**: el saldo anterior y el insoluto se calculan como total menos pagos previos menos notas de crédito aplicadas, convertidas a la moneda del documento relacionado. Prueba de extremo a extremo con nota de crédito intermedia.
- **N2**: el traslado de IVA se declara por grupo de tasa tomando los conceptos de la factura; si hay más de una tasa con IVA se rechaza con error claro en vez de timbrar un dato falso.
- **N17**: se admite la tasa 8% de frontera como opción de primer nivel (base de datos, recálculo de totales, mapeo al complemento y pantalla).

## Sub-ola D · Multi-moneda y montos (E3)

- **N9**: soporte real de EUR en presupuesto vs real (tipo de cambio propio por moneda o conversión centralizada en base de datos).
- **N14**: los anticipos se aplican al tipo de cambio de la fecha de aplicación, registrando el diferencial cambiario, y se acepta EUR igual que en los lotes.
- **N10**: base de retenciones neta de notas de crédito, el pago liquidador absorbe el residual y se marca para revisión al aplicar una nota de crédito.
- **M1-res**: el reporte de utilidad por cliente resta notas de crédito aplicadas y excluye facturas canceladas.

## Sub-ola E · Robustez de procesos (E3)

- **N18**: llaves de idempotencia en refacturación, cancelación de factura y anticipo de proveedor, y aprobación de nota de crédito, para que un doble clic no duplique documentos.
- **N25**: el importador de estados de cuenta identifica cada movimiento por su contenido normalizado (fecha, monto, referencia, concepto) y no por su posición en el archivo.
- **N19**: bitácora automática de cambios financieros (tipo de cambio y montos de embarque, datos de factura en borrador, movimientos bancarios y comisiones).
- **N-F2**: al actualizar un embarque, los conceptos ya facturados en proforma se excluyen en lugar de abortar todo el guardado, con aviso claro al usuario.

## Detalles técnicos

- Cada sub-ola incluye: migraciones SQL con higiene de permisos (REVOKE a `public`/`anon`, GRANT explícito), espejo del cambio en `baseline.sql` cuando aplique, y un archivo de guard en `supabase/tests/` que vigile el candado para que no se pierda en un futuro refactor.
- Los mensajes de error nuevos se registran como códigos `LC_*` con texto en español mexicano en los catálogos existentes.
- Pruebas unitarias nuevas para: parcialidad del complemento de pago con nota de crédito, agrupación de traslados por tasa, conversión EUR en presupuesto, retenciones netas y hash de movimientos bancarios.
- Se respetan los límites de tamaño de componente/función del proyecto; la lógica se extrae a módulos de dominio cuando un archivo crezca.
- Se sube `APP_VERSION` y se registra cada sub-ola en `CHANGELOG.md`.
- Riesgo a vigilar: los cambios de permisos de costos (C9) y los candados de tesorería pueden bloquear flujos existentes; se validan con las suites de RLS y las pruebas de integración antes de cerrar cada sub-ola.
