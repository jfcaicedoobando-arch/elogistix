# Anticipos a proveedor (pagar antes de la factura)

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
y ligado al anticipo. Si el anticipo se cancela, ese movimiento se da de baja y el saldo
del banco regresa.

## Reglas y validaciones

- Roles que pueden registrar, aplicar y cancelar: administrador, contador y tesorero.
- La moneda del anticipo debe coincidir con la moneda de la cuenta bancaria.
- No se puede cancelar un anticipo que ya tenga aplicaciones vivas: primero se reversan.
- El monto a aplicar nunca puede exceder el saldo a favor ni el saldo de la factura.
