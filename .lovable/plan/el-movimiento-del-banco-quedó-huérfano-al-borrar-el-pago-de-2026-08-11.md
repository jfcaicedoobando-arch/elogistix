# El movimiento del banco quedó "huérfano" al borrar el pago de FP-000100

## Qué pasó (confirmado en la base)

El pago de 62 USD de FP-000100 (`4673bfef…`) sí está borrado (baja lógica el 10/08 a las 18:19 hora MX).

Pero el movimiento bancario sigue vivo:

- Movimiento `9b417d06…` — "Pago prov. COSU6502914740 — COSCO SHIPPING LINES CO. LTD", cargo 62.00, fecha 10/08.
- `pago_proveedor_id` = vacío, `estado_conciliacion` = Pendiente, sin fecha de baja.
- Su huella (`hash_dedupe`) sigue siendo `pago-4673bfef…`, o sea: nació de ese pago.

Analogía: primero le quitaste la etiqueta con el nombre del pago a la hoja del estado de cuenta (desvincular), y después tiraste el pago a la basura. Cuando el sistema fue a buscar "la hoja con esa etiqueta" para tirarla también, ya no encontró nada — porque la etiqueta ya la habías quitado tú. La hoja se quedó en el estado de cuenta.

Causa técnica: `desconciliarMovimiento` pone `pago_proveedor_id = null`, y `eliminarMovimientoBancarioPago` busca el movimiento **sólo** por `pago_proveedor_id`. Si desvinculas antes de borrar, no hay coincidencia y el movimiento sobrevive.

## Qué voy a hacer

1. **Limpiar el caso concreto**: dar de baja el movimiento `9b417d06…` (62 USD, COSCO) para que desaparezca del estado de cuenta y de la conciliación. Es baja lógica: queda el rastro, no se pierde historial.

2. **Cerrar el hueco de raíz**: al borrar un pago, buscar el movimiento por `pago_proveedor_id` **o** por su huella `pago-<id del pago>`. Así el movimiento se va con el pago aunque antes se haya desvinculado. Mismo cambio aplica al editar un pago (que regenera el movimiento) para no dejar duplicados.

3. **Revisar si hay más casos**: buscar todos los movimientos vivos cuya huella sea `pago-…` de un pago ya borrado y darlos de baja en la misma limpieza.

4. **Prueba de regresión**: test unitario del flujo "desvincular → borrar pago" que verifique que el movimiento también se da de baja.

5. **Registro**: subir `APP_VERSION` y anotar el cambio en `CHANGELOG.md`.

## Detalles técnicos

- `src/features/cxp/services/pagoProveedorMovimiento.ts`: `eliminarMovimientoBancarioPago` pasa de un solo `.eq("pago_proveedor_id", pagoId)` a un filtro `.or("pago_proveedor_id.eq.<id>,hash_dedupe.eq.pago-<id>")`, conservando `.is("deleted_at", null)`.
- Limpieza de datos con el tool de datos (UPDATE de `deleted_at`/`deleted_by` en `bbva_movimientos`), no migración de esquema.
- Consulta de barrido: movimientos con `deleted_at is null` y `hash_dedupe like 'pago-%'` cuyo pago referenciado esté borrado o no exista.
- Test nuevo en `src/features/cxp/services/__tests__/` usando el patrón de cadena thenable de mocks de Supabase.
