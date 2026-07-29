## Qué pasó

El embarque `b55ca3a2…` está en estado **Cerrado** (confirmado en base de datos). Al eliminar una proforma, el sistema primero libera sus conceptos de venta (`estado_facturacion = pendiente`), y el candado de la base de datos (`trg_bloquear_cierre` sobre `conceptos_venta`) rechaza ese cambio con el error `23514`. Es como intentar corregir una factura que ya se archivó en la caja fuerte: el candado hace su trabajo, lo que falta es que la app no ofrezca el botón.

## Qué se va a hacer

1. **Tab Facturación (`TabFacturacion.tsx`)**: cuando el embarque esté Cerrado, deshabilitar las acciones que tocan proformas/conceptos (Eliminar, Editar, Generar proforma, Asignar conceptos) con tooltip: "Embarque cerrado — reábrelo para editar la facturación".
2. **Banner informativo** en el tab cuando el embarque esté Cerrado, con la indicación de reabrir el embarque.
3. **Red de seguridad**: en `useEliminarProforma`, traducir el error de candado (`23514` / mensaje "edición bloqueada") a un mensaje en español claro en lugar del texto técnico, por si el estado cambia en otra pestaña.
4. **Tests**: caso en los tests de `TabFacturacion` verificando que con estado `Cerrado` las acciones quedan deshabilitadas, y test del mapeo de mensaje de error.
5. **CHANGELOG.md** + bump de `APP_VERSION` a `13.334.8`.

## Detalles técnicos

- Se lee el estado del embarque ya disponible en el tab (prop/hook actual) — sin nuevas consultas.
- No se toca la base de datos: el trigger `tg_bloquear_si_embarque_cerrado` se conserva tal cual como última línea de defensa.
- Sin cambios de lógica de negocio, solo presentación y mensajes.
