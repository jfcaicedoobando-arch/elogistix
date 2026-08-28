# N13 · Devolución simple de anticipo de proveedor

Último pendiente real del backlog v5. Los otros ya están cerrados: N14 (anticipos en EUR) quedó resuelto en una ola anterior — `aplicar_anticipo_a_factura` ya convierte EUR y el cruce USD/EUR usando el T/C DOF de la fecha de aplicación.

## El problema

Hoy un anticipo pagado a un proveedor sólo tiene dos salidas: aplicarlo a facturas o **cancelarlo**. Cancelar es para "lo registré por error": borra el movimiento bancario y exige que no haya aplicaciones vivas.

No existe la salida real del negocio: *el proveedor nos regresó el dinero*. Ahí el pago sí ocurrió, el banco sí lo movió, y puede haber aplicaciones previas legítimas. Hoy eso se fuerza como cancelación, lo que borra evidencia bancaria.

Analogía: cancelar es romper el cheque antes de entregarlo; devolver es que el proveedor te deposite de vuelta lo que le sobró. Son dos asientos distintos y el ERP sólo tiene el primero.

## Alcance acordado (devolución simple)

- Marcar el anticipo como **devuelto** y dejar su saldo disponible en cero, sin crear un modelo de saldo a favor arrastrable.
- Registrar el reembolso como ingreso bancario ligado al anticipo, para que tesorería lo concilie contra el estado de cuenta.
- Conservar intactas las aplicaciones previas y el movimiento de salida original (no se borra nada).
- Fuera de alcance: notas de crédito automáticas, saldo a favor reutilizable en otras facturas, devoluciones parciales múltiples.

## Comportamiento

Botón "Registrar devolución" junto a las acciones del anticipo, visible sólo cuando hay saldo disponible mayor a cero y el estado es `disponible` o `aplicado_parcial`. Abre un diálogo que pide:

- Monto devuelto (predeterminado: el saldo disponible; no puede exceder el saldo).
- Fecha de la devolución.
- Cuenta bancaria donde entró el dinero.
- Referencia y motivo.

Al confirmar: el anticipo queda como devuelto con saldo cero, aparece un ingreso pendiente de conciliar en tesorería y la bitácora registra quién, cuándo, cuánto y por qué. Un segundo clic o una segunda pestaña no duplica la devolución.

Permisos: los mismos que cancelar — administración, contabilidad y tesorería.

## Detalles técnicos

Migración:

- Ampliar el CHECK de `anticipos_proveedor.estado` con `'devuelto'`; agregar columnas `devuelto_at`, `devuelto_by`, `monto_devuelto`, `motivo_devolucion`.
- Nueva RPC `public.devolver_anticipo_proveedor(p_id uuid, p_monto numeric, p_fecha date, p_cuenta_bancaria_id uuid, p_referencia text, p_motivo text)`, `SECURITY DEFINER`, `search_path = public`, siguiendo el patrón de `cancelar_anticipo_proveedor`:
  - `auth.uid()` obligatorio; rol en `admin, admin_org, super_admin, contador, tesorero`.
  - `SELECT ... FOR UPDATE` sobre el anticipo (idempotencia N18) y candado multi-tenant contra `current_user_org_id()`.
  - Rechaza estados `cancelado` y `devuelto`, monto no positivo o mayor a `saldo_disponible` (tolerancia de un centavo), y cuenta bancaria de otra organización.
  - Inserta en `bbva_movimientos` un `abono` con `anticipo_proveedor_id`, `estado_conciliacion = 'Pendiente'`.
  - Deja `saldo_disponible = 0`, `estado = 'devuelto'`, sin tocar `deleted_at` ni las aplicaciones.
  - Escribe en `bitacora_actividad` (módulo `cxp`).
  - `REVOKE EXECUTE` a `anon`; `GRANT` a `authenticated` (FIX-45).
- Revisar que el trigger `_recalc_anticipo_saldo` / `tg_anticipo_saldo` no reabra el saldo de un anticipo devuelto.

Frontend:

- `src/features/cxp/services/anticipos.ts`: wrapper `devolverAnticipo` con manejo del `error` de la RPC.
- Hook `useDevolverAnticipo` en `useAnticipoProveadorMutations` con invalidación de las query keys de anticipos, proveedor y tesorería.
- `DevolverAnticipoDialog.tsx` con `FormDialogShell` (espejo de `CancelarAnticipoDialog`), `MoneyInput` y `DatePickerMx`; montos en la moneda del anticipo.
- Acción en `buildAnticipoColumns.tsx` y en `ProveedorAnticiposCard.tsx`; badge "Devuelto" en el estado.

Pruebas y cierre:

- Vitest del servicio y del diálogo (tope de monto, estados deshabilitados).
- Actualizar `docs/auditoria/backlog-v5-estado.md`, `CHANGELOG.md` y `APP_VERSION` (13.791.0).
