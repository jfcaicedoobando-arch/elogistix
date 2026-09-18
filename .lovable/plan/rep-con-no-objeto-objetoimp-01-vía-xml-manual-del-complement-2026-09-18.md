# REP con "No objeto" (ObjetoImp 01) vía XML manual del complemento

## Qué se quiere lograr

Hoy, cuando se registra el cobro de una factura PPD que trae renglones "No objeto de impuesto", el recibo de pago (REP) se detiene con un error claro: el formulario de la API no tiene la casilla `ObjetoImpDR`. El proveedor confirmó que la única salida es que nosotros armemos el XML del complemento de pago y lo mandemos en el nodo `complements`.

El objetivo es emitir ese REP correctamente, sin inventar datos fiscales y sin perder la red de seguridad actual.

## Alcance

1. **Generador del complemento (nuevo)** — Construir el XML `pago20:Pagos` versión 2.0 a partir del mismo contexto que hoy alimenta el pago: fecha, forma de pago, moneda, tipo de cambio, monto, y por documento relacionado el UUID, serie, folio, moneda, parcialidad, saldo anterior, importe pagado, saldo insoluto, `ObjetoImpDR` y, sólo cuando es `02`, el bloque de impuestos (traslados y retenciones) ya calculado por los helpers existentes.
2. **Reutilizar la aritmética actual** — No se recalculan bases ni tasas: los grupos de traslado y retención que ya produce `trasladoDr.ts` / `retencionesDr.ts` se serializan tal cual, con el mismo redondeo a dos decimales y el prorrateo vigente.
3. **`ObjetoImpDR` por documento relacionado** — `01` cuando *todos* los renglones de la factura son "no objeto" (sin nodo de impuestos), `02` en cualquier otro caso. Una factura mixta (16% + no objeto) es `02` y declara únicamente los impuestos reales de los renglones gravados; nada se reclasifica a Exento ni a tasa 0%.
4. **Ruta de emisión** — El payload sigue siendo `type: "P"`. Cuando la factura tiene renglones "no objeto", en lugar del bloque estructurado `{ type: "pago", data: [...] }` se envía el XML generado. Todo lo demás (receptor, serie, sección de referencias del PDF, `external_id` del claim) queda igual.
5. **Barrera y recuperación** — El bloqueo actual deja de disparar la ruta manual, pero se conserva como red: si el proveedor rechaza el XML, el pago queda con estado de error y mensaje explícito, recuperable, sin duplicar ni perder el cobro y sin marcarse como timbrado. Nada cambia en el flujo PUE ni en facturas sin renglones "no objeto".
6. **Pruebas** — Serialización del XML (estructura, atributos obligatorios, `ObjetoImpDR` 01 sin impuestos, mixta con 02 y sólo el IVA gravado, retenciones, moneda distinta con tipo de cambio), regresión de que el camino normal sigue usando el bloque estructurado, y que el rechazo del proveedor deja el pago en error recuperable.
7. **Documentación** — Nota en la guía interna de facturación: por qué existe el XML manual, qué responsabilidad fiscal asumimos y cómo verificar un REP emitido por esa ruta.

## Detalles técnicos

- Nuevo módulo `supabase/functions/facturapi-emitir-rep/pagoXml.ts` (generador puro, sin red, < 200 líneas; si crece se parte en `pagoXml.ts` + `pagoXmlDr.ts`).
- Escapado estricto de atributos XML; namespaces `pago20` y `schemaLocation` de Pagos 2.0; `Version="2.0"`.
- `helpers.ts · buildRepPayload` decide la ruta con una bandera derivada del contexto (`usarXmlManual`), calculada del mismo dato que hoy produce `resolverGruposTrasladoDr` — sin nuevas tablas, columnas ni configuración.
- `index.ts`: el caso `"no_objeto"` deja de responder 422 y pasa el detalle de tratamiento por renglón al contexto. Los demás bloqueos (`indeterminado`, `sin_importes`, `conceptos_ilegibles`) se conservan intactos, igual que el claim atómico previo al timbrado.
- `trasladoDr.ts`: se agrega un resolvedor que reporta el `ObjetoImpDR` del documento sin alterar las funciones existentes.

## Riesgos que conviene tener presentes

- Al armar el XML nosotros, la validez del complemento (versión, estructura, orden de nodos) queda de nuestro lado; el proveedor sólo lo sella.
- La ruta no es verificable aquí: la primera emisión real conviene hacerla en ambiente de pruebas del proveedor y revisar el XML sellado con Contabilidad antes de usarla en producción.
- Si el proveedor rechaza el XML, quedamos igual que hoy (pago en error recuperable), sin retroceso.

## Fuera de alcance

Cambios en la emisión de la factura (ya funciona), migraciones de base, publicación o despliegue, y cualquier reclasificación automática de tratamientos fiscales.
