# Pago múltiple de cliente (cobro en lote)

Un solo depósito del cliente se reparte automáticamente entre varias de sus facturas, igual que ya funciona el "Pago en lote a proveedor" en Cuentas por Pagar.

## Qué verá el usuario

1. En **Cartera (CxC)**, al abrir un cliente, podrá seleccionar varias facturas con saldo y pulsar **"Cobro en lote"**. El mismo botón aparecerá en **Facturación → Facturas emitidas** cuando la selección sea de un solo cliente y una sola moneda.
2. Se abre un modal con:
   - Fecha del depósito, forma de pago, referencia bancaria, cuenta bancaria destino y notas.
   - Importe total recibido (con captura de dinero formateada, usando `MoneyInput`).
   - Tabla de renglones: una línea por factura con folio, vencimiento, saldo y monto asignado.
3. El reparto se propone automáticamente **FIFO por vencimiento** (primero la más antigua) y cada renglón es editable a mano.
4. Se muestran en vivo: total repartido, sobrante sin aplicar y qué facturas quedan liquidadas o parciales.
5. Al guardar: se crean los pagos, **un solo movimiento bancario** con la referencia del depósito, y para cada factura timbrada **PPD** se dispara el REP automático como hoy.

## Reglas de negocio

- Todas las facturas deben ser del **mismo cliente** y la **misma moneda**; la cuenta bancaria debe coincidir en moneda.
- Nunca se asigna más que el saldo de cada factura (saldo = total − pagos − notas de crédito aplicadas), ni más que el importe total capturado.
- Mínimo dos facturas con monto mayor a cero (para un solo pago ya existe el flujo individual).
- El sobrante no se aplica: se avisa al usuario para que lo registre como anticipo o ajuste el importe.
- Todo o nada: si algo falla, no queda ningún pago a medias.
- Requiere permiso de captura de cobros; si el usuario no lo tiene, el botón no aparece.

## Detalles técnicos

- **Base de datos**: nueva RPC `public.registrar_pago_cliente_lote(p_payload jsonb)` (SECURITY DEFINER, `search_path=public`), espejo de `registrar_pago_proveedor_lote`:
  - Valida tenancy con `org_scope()` y que todas las facturas pertenezcan al mismo cliente/org/moneda y estén vivas (`assert_factura_viva_para_pago`).
  - Bloqueo `FOR UPDATE` de las facturas, recálculo de saldo servidor-side, inserta N filas en `pagos_factura` + 1 abono en `bbva_movimientos`, registra en `bitacora_actividad`, devuelve los `pago_id` creados.
  - `REVOKE ALL ... FROM PUBLIC`, `GRANT EXECUTE` a `authenticated` y `service_role` (whitelist FIX-45 sin anon).
- **Servicio**: `src/features/facturacion/services/pagoClienteLote.ts` con `repartirFifo`, `validarLote` y `registrarPagoClienteLote` (reutiliza `roundMoney` de `financialUtils`).
- **Hook**: `useCobroLoteState` (estado del modal) + `useRegistrarPagoClienteLote` (mutación, invalidación de query keys de facturas/cartera/tesorería, `onError` con `notifyError`).
- **UI**: `DialogCobroLoteCliente.tsx` con `FormDialogShell` + `FormDialogSection`, dividido en `...Datos.tsx` y `...Renglones.tsx` para respetar el límite de 200 líneas.
- **REP**: tras la RPC, se recorren los `pago_id` de facturas PPD timbradas y se llama `emitirRep` con manejo individual de errores (un REP fallido no invalida el cobro).
- **Pruebas**: unitarias de `repartirFifo`/`validarLote` (centavos, sobrante, exceso de saldo), pruebas del modal (permisos, moneda mixta, edición manual) y suite SQL `supabase/tests/` para tenancy y atomicidad de la RPC.
- **Cierre**: bump de `APP_VERSION` y entrada en `CHANGELOG.md`.
