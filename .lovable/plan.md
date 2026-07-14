## Objetivo
Permitir que un usuario autorizado elimine (soft delete) un pago sin que la policy de backend lo bloquee, y dejar un solo toast de error si algo falla.

## Diagnóstico
- El error real ya quedó visible: la policy restrictiva `Hide soft deleted pagos_factura` tiene `WITH CHECK (deleted_at IS NULL)`.
- En un `UPDATE` para soft delete, la fila nueva queda con `deleted_at != null`, entonces esa policy restrictiva bloquea la operación aunque el usuario tenga rol `contador`.
- El doble toast ocurre porque:
  1. `useEliminarPagoFactura` muestra el toast real con `DELETE_PAYMENT`.
  2. `FacturaPagosSection.tsx` vuelve a mostrar otro toast genérico en el `catch`.

## Cambios propuestos

### 1. Backend: ajustar RLS de `pagos_factura`
Crear una migración para reemplazar la policy restrictiva `Hide soft deleted pagos_factura` por una versión que:
- Mantenga ocultos los pagos ya eliminados en lectura.
- Permita que usuarios autorizados hagan el `UPDATE` que marca `deleted_at` y `deleted_by`.
- No abra acceso anónimo ni permisos extra.

Técnicamente, la forma segura es separar la regla por operación:
- `SELECT`: sólo filas con `deleted_at IS NULL`.
- `UPDATE`: permitir que el update parta de una fila activa; el permiso real de rol/organización sigue protegido por `Tenant CRUD pagos_factura`.

### 2. Frontend: quitar el segundo toast
Actualizar `FacturaPagosSection.tsx` para que el `catch` sólo absorba la promesa rechazada y no emita otro `notifyError`.

Analogía: el hook ya es la alarma principal; el componente estaba tocando una segunda alarma con menos información.

### 3. Versionado
- Bump `APP_VERSION` a `13.299.8`.
- Agregar entrada en `CHANGELOG.md` explicando:
  - Fix RLS para soft delete de pagos.
  - Fix doble toast al fallar eliminación de pago.

## Validación
- Revisar que la policy quede separada correctamente en backend.
- Confirmar que ya no haya segundo `notifyError` en `FacturaPagosSection.tsx`.
- Si se vuelve a intentar borrar el pago, debe:
  - Eliminarse correctamente si el rol/organización tiene permiso.
  - O mostrar un solo toast con el error real si existe otro bloqueo.