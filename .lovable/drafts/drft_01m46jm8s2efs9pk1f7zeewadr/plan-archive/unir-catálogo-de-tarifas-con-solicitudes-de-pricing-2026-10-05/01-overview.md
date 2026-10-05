# Unir Catálogo de tarifas con Solicitudes de pricing

## Qué vas a ver
- En el menú de Costeo, la pantalla que hoy es **Catálogo de tarifas** se llamará **Solicitudes de pricing**. Se ve igual que hoy: tarjetas/tabla con agente, naviera, ruta, contenedor, flete, vigencia, tránsito y estado.
- Cada tarifa de esa pantalla podrá mostrar a qué solicitud responde (folio y cliente). Las tarifas viejas sin solicitud se siguen viendo igual.
- Al responder una solicitud, Pricing ya no llena un formulario aparte: **da de alta una tarifa** con el mismo formulario del catálogo, ya ligada a la solicitud. Puede agregar varias (una por opción).
- La ficha de la solicitud (y la pestaña Pricing de la oportunidad) muestra esas tarifas como respuesta.
- Folio nuevo: **mes en 3 letras + año en 2 dígitos + consecutivo de 4 dígitos**, que vuelve a 0001 cada mes. Ejemplo: OCT260001, OCT260002… y en noviembre empieza NOV260001.
- Las 3 solicitudes actuales cambian: SEP0081 pasa a OCT260001, SEP0082 a OCT260002 y SEP0083 a OCT260003.

## Cómo se acomodan los campos

| Respuesta de pricing hoy | En el catálogo | Qué hacemos |
|---|---|---|
| Agente (texto libre) | Agente (catálogo) | Se usa el del catálogo |
| Carrier | Naviera | Se usa el mismo campo |
| Tiempo de tránsito | Días de tránsito | Se usa el mismo campo |
| Ruta (texto) | Ruta (catálogo) | Se usa el mismo campo |
| OF tarifa + moneda | Flete base + moneda | Se usa el mismo campo |
| OF unidad | (no existe) | Se agrega a la tarifa |
| Carta garantía Sí/No | (sólo por naviera) | Se agrega a la tarifa |
| Cargos en origen, Recolección, Otros (tarifa/moneda/unidad) | Recargos de la tarifa | Se guardan como recargos con su nombre, moneda y unidad |

## Supuestos (dime si alguno no es así)
- El catálogo **no desaparece como datos**: las tarifas actuales siguen sirviendo para cotizar; sólo cambia el nombre y la entrada de la pantalla.
- Los meses van en español: ENE, FEB, MAR, ABR, MAY, JUN, JUL, AGO, SEP, OCT, NOV, DIC.
- La única respuesta capturada hoy con el formulario viejo se copia como tarifa ligada a su solicitud.
