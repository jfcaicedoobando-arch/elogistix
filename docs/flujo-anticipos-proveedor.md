# Anticipos a proveedor (pagar antes de la factura)

> Revisión documental: 2026-09-26. Confirmar rol/destino antes de registrar dinero.

Flujo para cuando el proveedor pide el pago **antes** de enviar su factura.

## 1. Registrar el anticipo

Compras → **Anticipos a proveedores** → *Registrar anticipo*.

- Proveedor, fecha, monto y moneda.
- **Cuenta bancaria**: obligatoria salvo que el método sea *Efectivo*. Sólo se listan
  cuentas activas en la misma moneda del anticipo.
- **Tipo de cambio**: se pide cuando la moneda no es MXN y llega precargado con el
  tipo de cambio del DOF. Es editable.

Al guardar, el sistema crea el **cargo bancario conciliado** en esa cuenta (el saldo de
tesorería baja de inmediato) y el anticipo queda con estado *Disponible*.

## 2. Capturar la factura cuando llegue

Buzón de facturas de proveedor (XML o PDF con IA) → capturar → **aprobar** la factura.
Sólo las facturas aprobadas y con saldo pueden recibir anticipos.

## 3. Aplicar el anticipo

Dos caminos, el resultado es el mismo:

- Desde el **detalle de la factura** → pestaña *Pagos*: aparece el aviso
  "Este proveedor tiene saldo a favor" con el botón **Aplicar anticipo**. El monto
  sugerido es el menor entre el saldo a favor y el saldo de la factura.
- Desde **Anticipos a proveedores** → acción *Aplicar* en el renglón del anticipo.

La aplicación genera el pago marcado como *anticipo aplicado*: **no** vuelve a descontar
efectivo del banco, sólo consume el saldo a favor y baja el saldo de la factura.

## 4. Pagar la diferencia

Si la factura resultó mayor que el anticipo, se registra un pago normal por el resto.
Si resultó menor, el remanente sigue disponible para otra factura del mismo proveedor.

## 5. Conciliar

Tesorería → *Estado de cuenta*: el movimiento del anticipo ya aparece como **Conciliado**
y ligado al anticipo. La cancelación/reversión sigue el flujo servidor; un movimiento real del banco
no desaparece físicamente por cambiar el estado del anticipo en el ERP.

## 6. Vincular el anticipo con un embarque (opcional)

Operaciones necesita saber de qué expediente salió el dinero adelantado:

- Al **registrar** el anticipo hay un buscador de embarque (opcional).
- Después se puede ligar o corregir con la acción **Vincular embarque** en la bandeja
  de *Anticipos a proveedores*.
- El expediente aparece como columna en la bandeja y como tarjeta
  **"Anticipos a proveedores de este embarque"** en la pestaña *Costos* del embarque.
- Si se aplica el anticipo a una factura de otro expediente, sale un **aviso amarillo**
  que no bloquea: hay casos legítimos (anticipo general, expediente corregido después).

En cruces de moneda, comparar saldo a favor/aplicación/saldo de factura en
las monedas y paridades que define la RPC. No comparar MXN contra USD como
números sin convertir ni usar TC actual para una aplicación histórica.

## Reglas y validaciones

- Roles que pueden registrar, aplicar, vincular y cancelar: administrador, contador y tesorero.
- La moneda del anticipo debe coincidir con la moneda de la cuenta bancaria.
- No se puede cancelar un anticipo que ya tenga aplicaciones vivas: primero se reversan.
- El monto a aplicar nunca puede exceder el saldo a favor ni el saldo de la factura.
- No se puede vincular un embarque a un anticipo cancelado ni a un embarque de otra organización.

## Estado de cuenta y devoluciones

El anticipo entregado aparece como abono en su fecha original. Su aplicación a una
factura de la misma moneda es informativa (cargo y abono cero). En monedas distintas,
la aplicación reclasifica el crédito en su fecha efectiva: un cargo por el importe
consumido en la moneda del anticipo y un abono en la moneda de la factura.

El abono usa sólo `pagos_proveedor.monto_en_moneda_factura`, conservado a cuatro
decimales al registrar la aplicación. La consulta no recalcula ese importe con el
DOF, el tipo de cambio de la factura ni `pagos_proveedor.tipo_cambio_usd`: los registros
históricos no comparten necesariamente la misma regla de conversión. Si falta el
importe congelado, se excluyen ambos lados monetarios de la reclasificación y se
informa la conversión pendiente. Saldo de factura, estado de cuenta, antigüedad y
Cierre usan la misma selección. Una factura marcada *Pagada* con una aplicación
activa sin importe congelado conserva en la antigüedad el saldo calculado con los
pagos y NC conocidos; esa excepción no cambia el tratamiento de las demás facturas
históricas marcadas *Pagada*. Cierre permanece pendiente mientras haya una
conversión desconocida. Los pagos directos conservan su conversión habitual.
La reclasificación no crea otro movimiento bancario ni reescribe datos históricos.
La devolución aparece como **Devolución de anticipo**, con cargo por `monto_devuelto`:
un anticipo de 25 con aplicación de 10 y devolución del remanente de 15 reduce la deuda
sólo en 10. Una devolución completa sin aplicaciones deja efecto neto cero.

La fecha efectiva de devolución se toma del movimiento bancario de devolución
vinculado al anticipo. Para datos históricos sin ese movimiento, se usa `devuelto_at`
en la fecha de negocio México; si falta, `updated_at` y finalmente la fecha del anticipo.
El detalle del movimiento aclara que la fecha de registro se usa como referencia.
Este cálculo también reconoce montos devueltos parciales históricos; no habilita
nuevas devoluciones parciales del saldo disponible ni modifica registros históricos.
