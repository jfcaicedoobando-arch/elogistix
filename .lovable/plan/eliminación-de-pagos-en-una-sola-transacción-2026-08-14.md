# Eliminación de pagos en una sola transacción

## Problema

Hoy, borrar un pago son **tres viajes separados** al servidor desde el navegador:

1. Se marca el pago como eliminado.
2. Se da de baja el movimiento bancario ligado.
3. Se escribe la bitácora.

Si el paso 2 falla (se cae la red, expira la sesión, el usuario cierra la pestaña), el pago desaparece pero el movimiento bancario sigue vivo: el saldo del banco queda inflado o deflactado y la conciliación nunca cuadra. Es como cancelar un cheque en la chequera y olvidar avisarle al banco.

Hoy no hay huérfanos en la base (verificado: 0 en cliente y 0 en proveedor), así que este cambio es preventivo, no correctivo.

Lo que sí ya es transaccional: el estado de liquidación de los costos (`conceptos_costo`) y el estado de la factura se recalculan por disparadores de base de datos que corren dentro de la misma transacción del pago. Ese comportamiento se conserva tal cual.

## Qué se va a construir

Dos funciones de base de datos (RPC) que hacen todo el trabajo en **una sola transacción, todo o nada**:

- `eliminar_pago_cliente(pago_id, motivo)` — pagos de facturas de venta.
- `eliminar_pago_proveedor(pago_id, motivo)` — pagos a proveedores.

Cada una, en orden y de forma atómica:

1. Valida que el pago exista, no esté ya eliminado y pertenezca a la organización activa del usuario.
2. Valida permisos (mismos roles que hoy pueden borrar pagos: tesorería, contabilidad y administración) y respeta el candado fiscal existente: si el pago tiene un complemento de pago (REP) vigente, se rechaza con el mensaje en español actual.
3. Marca el pago como eliminado (borrado lógico, con usuario y fecha).
4. Ajusta el movimiento bancario según su origen:
   - **Generado por el sistema** (el abono/cargo que creó el propio pago): se da de baja lógica junto con el pago.
   - **Importado del estado de cuenta**: NO se borra. Se desvincula del pago y regresa a estado "Pendiente" de conciliación, para que el movimiento real del banco siga existiendo y pueda reconciliarse con otro documento.
5. Deja el recálculo de costos y del estado de la factura en manos de los disparadores actuales (misma transacción).
6. Registra la bitácora dentro de la transacción, con el motivo capturado.
7. Devuelve un resumen (pago eliminado, qué pasó con el movimiento bancario, costos afectados) para que la interfaz muestre un mensaje exacto en lugar de un genérico.

Si cualquier paso falla, **nada** se guarda: el pago sigue vivo y el banco intacto.

## Cambios en la aplicación

- `eliminarPagoFactura` (facturación) y `eliminarPagoProveedor` (CxP) pasan a llamar la RPC correspondiente en vez de hacer los tres viajes sueltos. Se conservan los errores tipados actuales (`PagoConRepVivoError`) mapeando los códigos que devuelve la base.
- Los mensajes de confirmación en pantalla indican qué pasó con el movimiento bancario ("se dio de baja el abono" vs. "el movimiento importado quedó pendiente de conciliar").
- Se retiran las llamadas ahora redundantes a `eliminarMovimientoBancarioCobro` / `eliminarMovimientoBancarioPago` desde el flujo de borrado (las funciones se conservan para otros usos).

## Vigilancia

- Nuevo guardrail `movimiento_vivo_con_pago_eliminado` en `scripts/db/integrity-guard.sql`: falla el CI si aparece un movimiento bancario vivo ligado a un pago eliminado.
- Nueva suite RLS `test_rls_eliminar_pago_atomico.sql` con casos: borrado feliz (movimiento generado se da de baja), movimiento importado (se desvincula y queda pendiente), pago con REP vigente (se rechaza y nada cambia), pago de otra organización (se rechaza), rol sin permiso (se rechaza) y recálculo del estado de liquidación del costo.
- Pruebas unitarias de los dos servicios contra la RPC mockeada (incluye el mapeo del error de REP vigente).

## Detalles técnicos

- Ambas funciones: `plpgsql`, `SECURITY DEFINER`, `SET search_path = public`, con bloque H6 obligatorio en la misma migración (`REVOKE ALL … FROM PUBLIC, anon` + `GRANT EXECUTE … TO authenticated, service_role`).
- Códigos de error estándar: `LC_PAGO_NO_ENCONTRADO`, `LC_PAGO_YA_ELIMINADO`, `LC_ORG_FORBIDDEN`, `LC_PAGO_SIN_PERMISO`, `LC_PAGO_CON_REP_VIVO` (se mantiene el token actual para no romper el manejo en el cliente).
- Autorización vía las funciones existentes de rol efectivo/permisos, no listas de roles duplicadas.
- Discriminación del movimiento bancario por `hash_dedupe` (`cobro-<pago_id>` / `pago-<pago_id>`) = generado por el sistema; cualquier otro movimiento ligado = importado, se limpia `pago_factura_id` / `pago_proveedor_id` y se pone `estado_conciliacion = 'Pendiente'`.
- Idempotencia: si el pago ya está eliminado, la RPC no vuelve a tocar el banco ni la bitácora.
- Archivos espejo en `supabase/schema/tesoreria/` para el baseline de esquema, más `CHANGELOG.md` y `APP_VERSION`.
