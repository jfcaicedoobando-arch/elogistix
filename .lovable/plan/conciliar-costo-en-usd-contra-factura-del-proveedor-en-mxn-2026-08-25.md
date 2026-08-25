# Conciliar costo en USD contra factura del proveedor en MXN

## Qué está pasando en tu caso (ELIMP00329)

El costo presupuestado del embarque está en **51.00 USD** y el proveedor te facturó **872.57 MXN**. En el paso 3 del wizard, el recuadro de importe de cada concepto está etiquetado con la moneda del **costo** (USD), pero la barra de tope y los ajustes de costo trabajan con la moneda de la **factura** (MXN). Hoy nada convierte entre las dos.

Consecuencia verificada en el código y en la base:
- El tope suma los importes vinculados en crudo y los compara contra el subtotal de la factura (`calcularTopeVinculacion`), sin mirar monedas.
- Si capturas 872.57 en la línea del concepto de 51 USD, el sistema crea un "ajuste de costo" por la diferencia (872.57 − 51 = 821.57) en la moneda de la factura (`crear_ajustes_factura_proveedor_rpc` usa `proveedor_facturas.moneda`), inflando el costo del embarque.
- Si capturas 51, la factura queda con 821.57 MXN sin asignar y el concepto no se liquida.

Analogía: es como pagar una cuenta de 51 dólares con un billete de 872 pesos y que la caja anote "sobrepago de 821" porque no sabe que son monedas distintas.

## Qué se va a construir

Regla única: **los importes vinculados siempre se capturan en la moneda de la factura**, y el sistema convierte el costo cotizado con el T/C DOF de la fecha de emisión.

En el paso 3 (Vincular a costos de embarque), cada concepto en otra moneda mostrará:

```text
Flete marítimo
Cotizado: 51.00 USD  ≈  872.57 MXN   (T/C DOF 17.1092 · 05/08/2026)
[ MXN  872.57 ]        T/C aplicado: 17.1092
```

- Al marcar la casilla, el importe se pre-llena ya convertido a MXN (no en USD como hoy).
- El recuadro de captura queda etiquetado con la moneda de la factura, no con la del costo.
- Debajo se muestra el **T/C implícito** (importe capturado ÷ monto cotizado) para que veas a qué tipo de cambio estás cerrando; si se desvía más de ~2% del DOF, aparece un aviso ámbar (no bloquea).
- Si no hay T/C DOF para esa fecha, el concepto en otra moneda se marca como no conciliable con un aviso claro ("Captura el T/C o registra el DOF del día") en lugar de dejar que se mezclen cifras.
- La barra de tope y los ajustes de costo quedan comparando peras con peras: en tu caso, 872.57 MXN vinculados contra 872.57 MXN de subtotal → concepto liquidado al 100% y **sin ajuste espurio**.

## Detalles técnicos

- Nuevo módulo puro `src/features/cxp/utils/vinculoMoneda.ts`: `factorConversion`, `convertirMonto` y `tcImplicito`, con MXN como moneda pivote (soporta MXN/USD/EUR en ambos sentidos) y `roundMoney` de `financialUtils`. Sin React ni Supabase.
- `VincularEmbarqueSection.tsx`: recibe `fechaEmision` y obtiene el T/C con `useTcDofPorFecha` (ya existente, degradación silenciosa); pasa `facturaMoneda` + T/C hacia abajo.
- `VincularGruposSplit.tsx`: sólo propaga las nuevas props.
- `VincularListaConceptos.tsx`: presentación de la equivalencia, etiqueta del `MoneyInput` en la moneda de la factura, T/C implícito y aviso de desviación. Al marcar la casilla llama `onToggle` y luego `onChangeMonto` con el monto convertido (los reducers ya son funcionales, el orden se conserva).
- `PasoVinculacion.tsx`: pasa `ctl.values.emision`.
- Sin cambios de base de datos: la conversión ocurre antes de guardar, así que la RPC de ajustes sigue recibiendo importes en la moneda de la factura, que es lo que ya asume.
- Pruebas unitarias nuevas para `vinculoMoneda.ts` (equivalencias, sentido inverso, T/C faltante, EUR nulo) y actualización de las pruebas de `VincularListaConceptos` si existen.
- `CHANGELOG.md` + bump de `APP_VERSION`.

## Qué hacer mientras tanto con ELIMP00329

Con el wizard actual, la forma segura de cerrarlo sin ensuciar el costo del embarque es capturar la factura por 872.57 MXN y **no** vincular el concepto en USD desde el paso 3 (dejarlo pendiente); una vez aplicado este cambio, vinculas el concepto y queda liquidado con el T/C visible. Si prefieres cerrarlo hoy mismo, también puedo revisar el caso puntual en la base después de implementar el cambio.
