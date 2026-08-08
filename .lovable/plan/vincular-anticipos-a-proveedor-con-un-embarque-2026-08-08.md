# Vincular anticipos a proveedor con un embarque

Objetivo: que al registrar un anticipo (pago antes de la factura) los operadores puedan indicar el expediente/embarque al que corresponde, para amarrarlo después con la factura del proveedor cuando llegue.

## Cómo funcionará

1. **Al registrar el anticipo** aparece un campo nuevo *Embarque (opcional)* con buscador por expediente / BL / cliente (el mismo buscador que ya se usa al capturar facturas de proveedor).
2. **En la bandeja de Anticipos** se agrega la columna *Embarque* (chip con el expediente, clic = ir al embarque) y un filtro por expediente. Los anticipos sin embarque muestran un aviso discreto "Sin embarque".
3. **Ligar después:** desde el renglón del anticipo, acción *Vincular embarque* (también sirve para corregir o quitar el vínculo) mientras el anticipo no esté cancelado.
4. **Al aplicar el anticipo a una factura:** si la factura no tiene conceptos de ese embarque, se muestra una advertencia amarilla ("Este anticipo estaba ligado al expediente X y esta factura no toca ese embarque") y el contador puede continuar. No se bloquea.
5. **En el detalle del embarque** (pestaña Costos) se muestra una tarjeta *Anticipos ligados* con proveedor, monto, saldo disponible y estado, para que operaciones vea qué dinero ya se adelantó de ese expediente.
6. Todos los cambios (registrar, vincular, desvincular, aplicar) quedan en la bitácora del módulo Cuentas por pagar.

## Detalles técnicos

**Base de datos (una migración)**
- `anticipos_proveedor`: nueva columna `embarque_id uuid null references public.embarques(id) on delete set null` + índice parcial por `embarque_id`.
- `registrar_anticipo_proveedor`: nuevo parámetro `p_embarque_id uuid default null`, validando que el embarque pertenezca a la misma `organization_id` (error `LC_ANTICIPO_EMBARQUE_INVALIDO`).
- Nueva RPC `vincular_anticipo_embarque(p_id, p_embarque_id)`: valida org, rechaza anticipos cancelados, actualiza `embarque_id` y `updated_at`. Roles: admin/contador/tesorero (mismos que las RPC actuales de anticipos).
- Sin cambios en `anticipos_aplicaciones` ni en `aplicar_anticipo_a_factura` (la advertencia es de UI).

**Frontend**
- `registrarAnticipo.schema.ts`: campo opcional `embarqueId`.
- `RegistrarAnticipoFields.tsx`: sección "Vinculación" con buscador reutilizando `useBuscarEmbarquesPorTexto` (extraer un `EmbarqueCombobox` ligero desde `SugerirEmbarqueBlock` para no duplicar lógica).
- `services/anticipos.ts` + `anticiposProveedorService.ts`: pasar `p_embarque_id`, y select con join `embarques:embarque_id ( id, expediente )` para resolver el expediente en la bandeja.
- `buildAnticipoColumns.tsx`: columna Embarque; filtro nuevo en `AnticiposProveedor.tsx`.
- Nuevo `VincularEmbarqueAnticipoDialog.tsx` + hook `useVincularAnticipoEmbarque` (patrón `useMutationWithFeedback`, invalidando `anticiposProveedorKeys.all`).
- `AplicarAnticipoDesdeFacturaDialog.tsx` / `AplicarAnticipoDialog.tsx`: advertencia cuando el embarque del anticipo no coincide con los embarques de la factura (`factura_embarques` / conceptos vinculados).
- Tarjeta `AnticiposEmbarqueCard.tsx` en la pestaña Costos del detalle de embarque, con hook `useAnticiposPorEmbarque`.

**Cierre**
- Tests unitarios del servicio (nuevo parámetro) y del helper de advertencia de embarque.
- Actualizar `docs/flujo-anticipos-proveedor.md`, `CHANGELOG.md` y bump de `APP_VERSION`.
