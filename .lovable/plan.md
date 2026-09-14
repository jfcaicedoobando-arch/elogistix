# Mejorar el modal de Traspaso entre cuentas propias

Tres problemas concretos, tres correcciones. Sin agregar funciones nuevas ni cambiar la operación que se guarda.

## 1. El acomodo se desfasa

Hoy los campos Fecha, Monto, Tipo de cambio y Comisión viven en una misma rejilla de dos columnas. El campo de tipo de cambio sólo aparece cuando las cuentas son de distinta moneda, y al aparecer empuja a Comisión a otro renglón; además sus textos de ayuda (sugerencia del DOF, aviso de captura) estiran su celda y descuadran la pareja.

Corrección: separar en dos bloques con posición fija.
- Bloque "Importes y fecha": Fecha y Monto a transferir (dos columnas, siempre las mismas).
- Bloque "Conversión": aparece completo y a lo ancho sólo cuando las monedas difieren; contiene el tipo de cambio y sus textos de ayuda.
- Comisión pasa a quedar junto a la fecha/monto en una posición estable, sin moverse cuando aparece la conversión.

Resultado: nada salta de lugar al elegir cuentas.

## 2. No se pueden capturar 4 decimales en el tipo de cambio

El campo actual es un campo de dinero: recorta a 2 decimales, así que 18.4235 se queda en 18.42. Como es una cotización y no un importe, se cambia por el campo numérico con 4 decimales que ya se usa en el resto del sistema (misma convención que DOF/Banxico). El valor sugerido del DOF ya viene con 4 decimales y por fin se podrá conservar y editar completo.

La validación de banda (entre 5 y 40 pesos por divisa) se mantiene tal cual.

## 3. El monto que se va a recibir es difícil de entender

Hoy todo está en una sola frase larga dentro del campo del tipo de cambio.

Corrección: un resumen visual en la parte baja del modal, con tres renglones legibles:

```text
Sale de       BBVA MXN ····1234        − 100,000.00 MXN
Comisión                                    − 150.00 MXN
Entra a       BBVA USD ····5678          + 5,428.94 USD
Tipo de cambio usado: 1 USD = 18.4235 MXN
```

- Los importes en cifras grandes y alineadas, con la moneda de cada cuenta.
- La comisión sólo aparece cuando hay comisión.
- Cuando ambas cuentas son de la misma moneda, se omite el renglón del tipo de cambio.
- Mientras falte el tipo de cambio, el resumen muestra el aviso de que hace falta capturarlo, en lugar de un importe engañoso.
- El importe que se abona sigue calculándose exactamente como lo guarda el sistema (mismo redondeo a centavos), para que el resumen coincide centavo a centavo con el movimiento bancario.

## Detalles técnicos

- `DialogTraspasoCuentas.tsx`: reordenar secciones (`FormDialogSection` con `cols`/`flat`), extraer el resumen a un componente adyacente `TraspasoResumen.tsx` para mantener el modal ≤200 líneas (Power of 10).
- Tipo de cambio: sustituir `MoneyInput` por `NumericInput` con `decimals` (regex ya limita a 4 decimales); el estado `tcQuote` y `multiplicadorOrigenDestino` no cambian.
- `useTraspasoForm.ts` ya expone `montoDestino`, `par`, `factorOrigenDestino` y `fechaTcDof`; el resumen sólo consume esos derivados. Sin cambios de RPC, de esquema ni de datos.
- Etiquetas con `etiquetaTc(par)`, importes con `formatCurrency` y la cotización con `formatTipoCambio` (4 decimales).
- Pruebas: unitaria del resumen (misma moneda, distinta moneda con y sin comisión, tipo de cambio faltante) y ajuste de las pruebas existentes del modal si referencian el campo del tipo de cambio.
- Validación local: typecheck, lint y pruebas focalizadas de tesorería. Sin publicar.
