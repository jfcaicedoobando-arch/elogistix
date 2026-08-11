# Pagos a proveedor en embarques cerrados + mensaje de error claro

## Qué significa el error que viste

Estabas registrando un pago de la factura **FP-000024 (2,865 USD)**, que pertenece al expediente **ELIMP00154**, y ese embarque ya está en estado **Cerrado**.

Al guardar un pago, el sistema hace dos cosas: (1) anota el pago, y (2) va al costo del expediente y lo marca como "Pagado". El paso (2) es una edición del expediente, y hay un candado que impide tocar conceptos de un embarque cerrado. El candado disparó el error, y el pago completo se canceló.

Analogía: pagaste la cuenta, pero el sistema también quería tachar el renglón en un expediente que ya está archivado y sellado. El archivista dijo "esta carpeta ya está sellada" y por eso se deshizo todo el pago.

Además el toast fue ambiguo ("Los datos del pago no cumplen una regla del sistema") porque el traductor de errores atrapa primero la regla genérica de "violación de restricción" antes de revisar la regla específica de "embarque cerrado".

## Decisión de negocio

Pagar a un proveedor es una operación de tesorería y **debe permitirse aunque el expediente esté cerrado** (las facturas suelen pagarse después del cierre operativo). El candado existe para evitar que alguien cambie costos/importes de un expediente cerrado, no para frenar la sincronización automática del estado "Pagado/Pendiente".

## Cambios

### Base de datos (migración)
- En `public.recalcular_estado_liquidacion_concepto`: activar internamente el bypass de cierre (`app.bypass_cierre`) solo alrededor del `UPDATE conceptos_costo` que sincroniza `estado_liquidacion` y `fecha_pago`, y restaurarlo al terminar (incluso ante error). Es una sincronización del sistema, no una edición de usuario: no cambia importes, conceptos ni totales.
- Igual tratamiento en `recalcular_estado_liquidacion_factura` (que solo itera conceptos).
- Migración con `REVOKE`/`GRANT EXECUTE` explícitos para cumplir la auditoría H6.

### Mensajes de error (frontend)
- En `src/features/cxp/services/pagosProveedorErrors.ts`: mover la regla de "embarque cerrado" **antes** de la regla genérica `23514`, y mejorar el texto para que diga el motivo y la salida ("El expediente está cerrado; reábrelo desde el embarque para editar sus costos"). Cualquier `23514` residual conserva el detalle técnico en el mensaje en lugar de tragarlo.

### Regularización del caso reportado
- Verificar que FP-000024 quedó sin pagos registrados (el error revirtió todo) y confirmar que, ya con el fix, el pago de 2,865 USD se puede registrar normalmente desde la UI.

### Calidad
- Test unitario en `pagosProveedorErrors.test.ts`: un error 23514 con mensaje "Embarque cerrado: edición bloqueada (tabla conceptos_costo)" debe traducirse al mensaje específico de expediente cerrado.
- Test SQL: registrar un pago a una factura de proveedor cuyo embarque está `Cerrado` debe funcionar y marcar el concepto como `Pagado`, mientras que un `UPDATE` manual de importes en `conceptos_costo` sigue bloqueado.
- Actualizar `CHANGELOG.md` y `APP_VERSION` (13.497.1).
