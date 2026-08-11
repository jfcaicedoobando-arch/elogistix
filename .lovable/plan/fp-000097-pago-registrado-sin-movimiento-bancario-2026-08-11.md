# FP-000097: pago registrado sin movimiento bancario

## Qué pasó (confirmado en la base de datos)

La factura FP-000097 (embarque ELIMP00224, IFS NEUTRAL, 562 USD) sí tiene su pago registrado el 07/08/2026 desde la cuenta BBVA USD, y por eso está en "Pagada". Lo que nunca se creó fue el movimiento bancario espejo en tesorería, y la bitácora lo dejó marcado como `movimiento_tesoreria: no_creado`.

Causa: quien registró el pago fue Karol (rol **contador**). En ese momento la tabla de movimientos bancarios sólo permitía escribir a **admin**; el permiso para tesorero/contador se agregó el 10/08/2026 a las 20:27. La app intenta crear el movimiento pero **si falla no avisa** (guarda el pago y sigue), así que el usuario nunca vio el rechazo.

Evidencia:

- Sólo hay 2 pagos con cuenta bancaria y sin movimiento: FP-000097 (08/08 00:10) y FP-000100 (10/08 19:24) — ambos de Karol y ambos **antes** del cambio de permisos.
- Los pagos que Karol registró después (10/08 23:31, 23:32, 23:51) sí generaron su movimiento correctamente.

Es como una caja que sí registró la salida del dinero en la libreta del proveedor, pero el guardia no la dejó anotarla en el estado de cuenta del banco... y nadie le dijo que no la había dejado.

## Qué se va a hacer

1. **Reparar los 2 pagos huérfanos**: generar el movimiento bancario faltante de FP-000097 (562 USD) y FP-000100 (62 USD) en la cuenta BBVA USD, con la fecha real del pago, ya conciliado y vinculado al pago, para que el saldo de tesorería cuadre.
2. **Botón "Regenerar movimiento"** en la sección de Conciliación de tesorería, en cada incidencia "Sin movimiento en banco": crea el movimiento faltante sin tener que borrar y volver a capturar el pago. Sólo para pagos vivos que no tengan ya un movimiento y con permiso de tesorería.
3. **Dejar de fallar en silencio**: al registrar o editar un pago, si el movimiento bancario no se pudo crear, mostrar un aviso claro al usuario ("el pago se guardó, pero el movimiento en tesorería no; usa Regenerar movimiento") con el motivo real del rechazo, en lugar de sólo dejar la marca roja en la bitácora.
4. **Alerta de faltantes** en la conciliación: dejar visible el conteo de pagos sin movimiento para que se detecte el mismo día.

## Detalles técnicos

- **Backfill de datos**: inserción puntual en `bbva_movimientos` para los pagos `ac512f3b…` (FP-000097) y `4673bfef…` (FP-000100): `cuenta_bancaria_id = b5500294…` (BBVA USD), `cargo` en la moneda de la cuenta (USD, sin conversión: pago USD = cuenta USD), `hash_dedupe = 'pago-<pago_id>'`, `estado_conciliacion = 'Conciliado'`, `pago_proveedor_id` vinculado. Cumple el trigger `assert_movimiento_pago_consistente` (misma org, misma divisa, un solo vínculo).
- **Nueva RPC** `public.regenerar_movimiento_pago_proveedor(p_pago_id uuid)` SECURITY DEFINER: valida org del pago vs `org_scope()`, rol (`tesorero`/`contador`/`admin`/`admin_org`), que el pago esté vivo y tenga `cuenta_bancaria_id`, y que no exista ya un movimiento vivo; inserta el movimiento con el mismo contrato de arriba y devuelve el id. Con `REVOKE ALL … FROM PUBLIC, anon` + `GRANT EXECUTE … TO authenticated, service_role` en la misma migración (regla H6).
- **Frontend**:
  - `src/features/cxp/services/pagoProveedorMovimiento.ts`: `crearMovimientoBancarioPago` devuelve `{ ok, error }` en lugar de `boolean` (se conserva el estado de bitácora) y se agrega `regenerarMovimientoPagoProveedor(pagoId)`.
  - `src/features/cxp/services/pagosProveedor.ts` y `pagoProveedorActualizar.ts`: propagan el motivo del fallo para que la UI avise con `notifyError`/`notifyInfo` de `@/lib/ui/appFeedback`.
  - `src/features/cxp/components/ConciliacionTesoreriaSection.incidencias.tsx`: acción por fila para las incidencias `sin_movimiento`, con invalidación de queries de tesorería y CxP.
  - Archivos nuevos si algún componente pasa de 200 líneas (Power of 10).
- **Tests**: unitarios para `regenerarMovimientoPagoProveedor` (éxito, ya existe movimiento, pago sin cuenta) y para la propagación del error al registrar pago; prueba SQL de la RPC en `supabase/tests/` (idempotencia y aislamiento por organización).
- **CHANGELOG.md** + bump de `APP_VERSION`.
