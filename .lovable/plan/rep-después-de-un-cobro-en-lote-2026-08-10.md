# REP después de un cobro en lote

## Qué pasó con el pago de Karol (verificado en la base)

El lote de Karol (7 facturas, USD 67,833.50, hoy 21:56) sí registró los 7 pagos y dejó las facturas en **Pagada**. Los 7 pagos quedaron con `estado_rep = NoAplica`, es decir: **no se generó ningún REP, y en este caso no debía generarse** — ninguna de esas 7 facturas está timbrada (no tienen UUID fiscal ni método de pago PPD). El REP es el "recibo" de un CFDI que se emitió a crédito (PPD); si la factura nunca se timbró, no hay nada que complementar ante el SAT.

## Lo que sí nos falta implementar

Cuando el cobro en lote incluya facturas **PPD timbradas**, el REP hoy **no se intenta timbrar**:

- El pago individual (modal "Registrar pago") sí auto-timbra el REP al guardar.
- La RPC de cobro en lote solo inserta los pagos; nadie dispara el timbrado. Los pagos quedarían en la bandeja "REP pendientes" esperando acción manual.
- La bandeja "REP pendientes" es de solo lectura: hay que abrir factura por factura y timbrar desde el detalle. Con 7 facturas eso son 7 visitas.

## Propuesta

1. **Auto-timbrado tras el cobro en lote**: al terminar el lote, timbrar en secuencia el REP de cada pago que quedó en `Pendiente`, con un resumen al final ("5 REP timbrados, 1 con error") y sin revertir el cobro si el SAT falla.
2. **Acción de timbrado en la bandeja "REP pendientes"**: botón "Timbrar REP" por renglón y selección múltiple para "Timbrar seleccionados", reusando el mismo servicio y refrescando conteos. Es la red de seguridad para errores del SAT y para pagos históricos.
3. **Aviso previo en el modal de cobro en lote**: mostrar cuántas de las facturas seleccionadas requerirán REP (PPD timbradas), para que el contador sepa qué esperar.
4. **Pasos operativos** (documentados en la ayuda del módulo): Bandejas → Cartera → seleccionar facturas → Cobro en lote → los REP se timbran solos y se envían por correo; si alguno falla, queda en "REP pendientes" para reintentar.

Un REP por factura (que es lo que ya soporta el sistema) es válido ante el SAT. Emitir un solo REP con los 7 documentos relacionados es la variante más "elegante" fiscalmente, pero implica reescribir la función de timbrado; queda fuera de este alcance y se puede evaluar después.

## Detalles técnicos

- Nuevo helper de timbrado secuencial en `src/features/facturacion/services/pagoClienteLote.ts` (o archivo hermano para no pasar de 200 líneas) que reciba los `pago_id` devueltos por `registrar_pago_cliente_lote` y llame `emitirRep` uno por uno, agregando resultados.
- `usePagoClienteLote` invoca ese helper en `onSuccess`, invalida `queryKeys.facturacion.repPendientes` y `facturas.pagosAll`, y muestra un toast de resumen.
- `BandejaRepPendientes.tsx`: columna de acciones con `useTimbrarRep`, `rowSelection` + `CarteraSelectionBar`-style para "Timbrar seleccionados".
- El filtro de qué pagos requieren REP se toma de `estado_rep IN ('Pendiente','Error')`, tal como ya lo hace la bandeja; no se cambia el trigger `set_estado_rep_pago` ni la RPC (sin migraciones).
- Pruebas: unitaria del agregador de resultados (éxitos/errores) y de la acción de timbrado en la bandeja.
- Cierre: bump de `APP_VERSION` y entrada en `CHANGELOG.md`.
