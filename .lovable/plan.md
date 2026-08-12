# Corregir saldo inicial de BBVA MXN + habilitar edición de cuentas

## Situación verificada

En la base de datos, la cuenta `BBVA MXN` tiene `saldo_inicial = 467,788.69` con fecha de corte `06/08/2026`. El valor correcto es `535,548.69` (diferencia de 67,760.00).

Hoy en el ERP **no existe** ningún botón para editar una cuenta bancaria: la pantalla Tesorería › Cuentas solo permite **crear** y **eliminar** (la tarjeta de cuenta únicamente tiene el ícono de basurero). La función de actualización sí existe en el código de servicios (`actualizarCuenta`, con registro en bitácora) y los permisos de base de datos ya permiten que admin, admin_org, super_admin y tesorero actualicen la cuenta; simplemente falta la pantalla.

Por eso hacen falta dos cosas: corregir el dato ahora y dejar el flujo para que el usuario lo pueda hacer solo la próxima vez.

## Parte 1 — Corrección inmediata del dato

Actualizar la cuenta BBVA MXN a `saldo_inicial = 535548.69`, manteniendo la fecha de corte `06/08/2026`. Es un cambio de un solo campo: el saldo inicial es el punto de arranque, así que todos los saldos y el estado de cuenta se recalculan solos (saldo inicial + abonos − cargos). No se toca ningún movimiento, pago ni conciliación.

Analogía: es como corregir el número con el que empieza el marcador de un partido; las jugadas ya registradas no cambian, solo el total final se acomoda.

## Parte 2 — Flujo de edición en la pantalla (para que no se repita)

- Agregar un botón **Editar** (ícono de lápiz) en la tarjeta de cada cuenta, visible solo para quien tenga permiso de administrar cuentas (mismo criterio que hoy usa el botón de eliminar).
- Reutilizar el formulario existente de alta de cuenta para el modo edición: banco, alias, número, CLABE, moneda, saldo inicial y fecha de saldo inicial.
- Al abrir en modo edición, precargar los datos actuales de la cuenta.
- Al guardar, mostrar un aviso claro cuando cambie el **saldo inicial** o la **fecha de corte**, explicando que eso recalcula el saldo de la cuenta y la conciliación.
- El cambio queda registrado en la bitácora de actividad del módulo Tesorería (ya lo hace el servicio de actualización), con qué campos cambiaron y sus valores.
- Validaciones: alias obligatorio; no permitir cambiar la moneda si la cuenta ya tiene movimientos o pagos asociados (evita mezclar divisas en saldos ya registrados).

## Detalles técnicos

- Datos: `UPDATE public.cuentas_bancarias SET saldo_inicial = 535548.69 WHERE id = '479e66f3-d6c3-435a-9bed-bc4e313b1135'` (una sola fila).
- UI: nueva prop `onEditar` en `CuentaBancariaCard.tsx`; el modal de `TesoreriaCuentas.tsx` pasa a soportar modo `crear | editar`; `NuevaCuentaFormFields.tsx` se reutiliza sin cambios de estructura.
- Estado: extender `useTesoreriaCuentasController.ts` con `editTarget`, precarga del formulario y `submit` que llame a `actualizarCuenta` cuando haya `editTarget` (usar el hook de mutación existente o añadir `useActualizarCuenta` en los hooks de tesorería si no existe).
- Respetar Power of 10: si `useTesoreriaCuentasController.ts` o la página superan las 200 líneas, extraer el submit de edición a un archivo aparte.
- Tests: caso unitario del controlador para modo edición (precarga + patch enviado) y bloqueo de cambio de moneda con movimientos.
- Bump de `APP_VERSION` y entrada en `CHANGELOG.md`.
