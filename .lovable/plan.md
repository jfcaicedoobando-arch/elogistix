# Anticipos a proveedor: pagar antes de la factura

## Qué ya existe hoy (verificado)

- Página `/compras/anticipos` con listado, filtros por estado y proveedor, y los diálogos Registrar / Aplicar / Cancelar.
- Tabla `anticipos_proveedor` (monto, moneda, saldo disponible, estado, método de pago, cuenta bancaria, tipo de cambio) y `anticipos_aplicaciones`.
- Funciones de servidor `registrar_anticipo_proveedor`, `aplicar_anticipo_a_factura` y `cancelar_anticipo_proveedor`, con control de rol (admin, contador, tesorero) y bitácora.
- Al aplicar un anticipo a una factura aprobada se genera el pago correspondiente y la factura recalcula su saldo/estado.
- El detalle de la factura de proveedor muestra la tarjeta "Anticipos aplicados".

## Los huecos que faltan cerrar

1. **El anticipo no toca el banco.** Los saldos de tesorería se calculan desde `bbva_movimientos`, y esa tabla sólo tiene enlace a pagos de factura (`pago_proveedor_id`) y de cliente. Un anticipo registrado no genera cargo bancario, así que el dinero "sale" sin reflejarse en el estado de cuenta y no hay nada que conciliar.
2. **No se captura tipo de cambio.** El diálogo no pide tipo de cambio cuando el anticipo es en USD/EUR, aunque la aplicación a factura lo usa para convertir. Sin él, la conversión y el cargo bancario en pesos quedan mal.
3. **No hay visibilidad del saldo a favor.** El detalle del proveedor no muestra los anticipos ni el saldo disponible, y el detalle de la factura no ofrece "aplicar anticipo" cuando el proveedor tiene saldo a favor: hay que ir a buscarlo a otra pantalla.
4. **Sin indicadores.** Ni el tablero de Compras ni la página de anticipos muestran cuánto dinero hay adelantado y sin consumir.

## Lo que se va a construir

### 1. El anticipo genera movimiento bancario conciliado
- Nueva columna de enlace a anticipo en los movimientos bancarios, con la misma validación de organización que ya usan los pagos.
- Al registrar un anticipo con cuenta bancaria se crea el cargo en esa cuenta, ya marcado como conciliado y ligado al anticipo (concepto: "Anticipo — <proveedor>").
- El monto del cargo se expresa en pesos usando el tipo de cambio capturado, igual que hoy hacen los pagos a proveedor.
- Al cancelar el anticipo, su movimiento bancario se da de baja (borrado lógico) para que el saldo regrese.
- La aplicación del anticipo a una factura **no** genera un segundo cargo: el pago se marca como "anticipo aplicado" y sólo consume el saldo a favor, evitando doble descuento de efectivo.

### 2. Cuenta y tipo de cambio en la captura
- La cuenta bancaria es obligatoria salvo cuando el método es Efectivo (regla también validada en el servidor, no sólo en pantalla).
- Cuando la moneda es USD o EUR se pide el tipo de cambio, precargado con el tipo de cambio DOF del día y editable.
- Resumen en vivo en el diálogo: "saldo a favor que quedará disponible" y equivalente en pesos.

### 3. Saldo a favor visible donde se necesita
- **Detalle del proveedor:** tarjeta "Saldo a favor (anticipos)" con total por moneda, lista de anticipos vigentes y botón para registrar uno nuevo con el proveedor precargado.
- **Detalle de la factura de proveedor:** si el proveedor tiene saldo disponible, aviso con el monto y botón "Aplicar anticipo" que abre el diálogo con factura y monto sugerido (el menor entre saldo del anticipo y saldo de la factura). La tarjeta "Anticipos aplicados" gana el total aplicado y el enlace al anticipo origen.

### 4. Indicadores
- Tarjetas en `/compras/anticipos`: total anticipado, disponible por moneda y aplicado en el mes.
- Un indicador "Anticipos por aplicar" en el tablero de Compras que lleva a la página filtrada por disponibles.

### 5. Documentación
- Guía corta del flujo para el contador en `docs/` (registrar, esperar factura, aplicar, pagar diferencia, conciliar) y entrada en el CHANGELOG con incremento de versión.

## Cómo queda el flujo

```text
1. Pago adelantado    → Registrar anticipo (cuenta + moneda + TC)
                        → cargo bancario conciliado + saldo a favor
2. Llega la factura   → Capturar y aprobar la factura del proveedor
3. Cruce              → Aplicar anticipo (desde la factura o desde el anticipo)
                        → consume saldo a favor, baja el saldo de la factura
4. Diferencia         → Pago normal por el resto (si la factura fue mayor)
5. Conciliación       → El movimiento del anticipo ya aparece conciliado
                        en Tesorería → Estado de cuenta
```

## Detalles técnicos

- Migración: `bbva_movimientos.anticipo_proveedor_id uuid` con FK a `anticipos_proveedor`, índice parcial, ajuste de `assert_movimiento_pago_consistente` para aceptar movimientos de anticipo y actualización de las tres funciones de anticipos (`registrar_*` crea el movimiento con `hash_dedupe = 'anticipo-<id>'`; `cancelar_*` lo da de baja; validación de cuenta obligatoria salvo Efectivo).
- Frontend: `RegistrarAnticipoDialog` gana tipo de cambio (reutilizando el hook de TC inicial ya usado en embarques) y `proveedorIdInicial`; nuevo hook `useAnticiposDisponiblesProveedor`; nueva sección en el detalle de proveedor; aviso + botón en `FacturaProveedorTabs`; KPIs con los componentes de tarjeta unificados; tablas con `DetailTable`/`DataTable` y tokens de densidad existentes.
- Tests: unitarios del servicio y del cálculo de cargo en pesos, y test de la migración (patrón `src/lib/__tests__/anticipos-fase-p1.test.ts`).
