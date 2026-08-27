# Cierre de los 3 parches R2: qué quedó pendiente y qué vale la pena

Revisé los tres diffs contra el código y la base de datos actuales. La mayoría ya está aplicada (o resuelta de otra forma). Quedan 7 puntos con valor real y 3 que conviene descartar formalmente.

## Ya cubierto (no hay que hacer nada)

- B-01/B-06 (cancelar con CxC/CxP vivas, actor desde sesión), B-02 (baja con dependencias), B-04/B-20 (EERR con estados de ingreso real y NC por fecha de emisión), B-11/B-12 (candado de edición de cotizaciones), B-17 (fecha válida de NC), B-18 (conceptos de factura inmutables tras emitir).
- B-03 (TC DOF por fecha en pagos/facturas/NC), B-08/B-09 (proformas: drift de totales e IVA por tasa), B-21/B-22 (redondeo por línea y tolerancia de medio centavo), B-24 (búsquedas `.or()` seguras y cotas de fecha en NC).
- B-22 en base de datos: el estado "Pagada" ya lo recalcula el trigger `trg_recalcular_estado_factura` sobre `pagos_factura`, no hace falta tocar la RPC de cobro en lote.
- B-28: la tabla de respaldo `_backup_conceptos_venta_...` ya no existe en la base; el riesgo desapareció.
- B-23 (`.strict()` en todos los esquemas): decisión documentada en el código de no adoptarlo. Se deja así.

## Pendiente que vale la pena (propuesta de 2 etapas)

### Etapa 1 — Base de datos (5 candados)

1. **B-15 · Sobrecosto en aprobación de CxP.** Hoy se valida que los conceptos cuadren con el subtotal, pero nunca contra el costo comprometido del embarque: un proveedor puede sobrefacturar y aprobarse. Se agrega comparación contra los `conceptos_costo` vinculados: advertencia hasta 5% de exceso, rechazo con `LC_CXP_SOBRECOSTO` arriba de eso.
2. **B-14 · Vencimiento de facturas de proveedor.** No existe el trigger espejo del de facturas de cliente, así que el vencimiento queda nulo o a mano y el aging de CxP miente. Se crea `proveedor_facturas_set_fecha_vencimiento` (con escape manual vía GUC) y se quita el `DEFAULT CURRENT_DATE` de `facturas.fecha_vencimiento`.
3. **B-13 · Folio duplicado de proveedor.** Nada impide capturar dos veces la misma factura del mismo proveedor. Índice parcial de apoyo + trigger con advisory lock que rechaza duplicados nuevos sin romper los históricos.
4. **B-19 · Cantidades fraccionadas.** `conceptos_venta.cantidad` es entero: no se puede cobrar 1.5 días de demora. Se pasa a `numeric` y se ajustan los casteos `::int` de las RPC de guardado.
5. **B-16 · Periodos contables cerrados** (opcional, es el más invasivo). Tabla `periodos_contables` + trigger que rechaza documentos con fecha en un mes ya cerrado. Lo listo aparte porque cambia el flujo de captura y conviene decidirlo con contabilidad.

### Etapa 2 — Frontend (2 mejoras)

6. **B-07 · Costos ocultos para roles comerciales.** Hoy `vendedor` y `ejecutivo_pricing` ven costo, utilidad y margen en el dashboard. Se separa un permiso nuevo `canViewCosts` de `canViewFinancials` y la tabla de utilidad pasa a modo "solo ventas" para esos roles.
7. **B-27 · Paginación de bitácora por cursor.** El listado usa `range()` por offset; en tablas grandes se degrada. Se cambia a keyset `(created_at, id)`.

## Descartado (bajo valor)

- **B-26** reintentos automáticos en "marcar revisados en lote": el usuario ya ve los fallidos y puede reintentar; agrega complejidad sin beneficio claro.
- **B-05** compensación transaccional del vínculo cotización↔embarque: requiere una RPC nueva; se queda como deuda anotada.

## Sobre los tests

Hoy hay 1,162 archivos de prueba y los umbrales de cobertura del CI están en verde (líneas/sentencias 38%, funciones 30%, ramas 34%). Lo implementado de estos tres parches ya tiene pruebas; **los 7 puntos pendientes no tienen ninguna**. Cada punto de la propuesta incluye sus pruebas:

- Etapa 1: casos en las suites SQL de RLS/financiero (sobrecosto rechazado y tolerado, vencimiento derivado, folio duplicado rechazado, cantidad 1.5 aceptada), más sincronización de `baseline.sql`, espejos canónicos y manifiesto de migraciones.
- Etapa 2: pruebas de `usePermissions` (roles comerciales sin `canViewCosts`) y de la tabla de utilidad en modo "solo ventas"; prueba de paginación keyset del servicio de bitácora.

## Notas técnicas

- Las migraciones se escriben con la fecha de hoy (no con los nombres `20260826*` del diff, ya superados) y con ACLs explícitas H6.
- Tras Etapa 1: regenerar `supabase/schema/baseline.sql` con el formato de CI, actualizar espejos de replay y el manifiesto.
- Se sube `APP_VERSION` y se registra en `CHANGELOG.md`.
