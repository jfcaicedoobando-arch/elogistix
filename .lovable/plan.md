# Buzón de facturas de proveedor: mostrar importes sin IVA

## Problema

En el buzón (`/compras/buzon`) el importe de cada documento es el **total del CFDI**, es decir con IVA. En el ERP todos los costos se manejan **sin IVA**, así que el operador compara peras con manzanas: ve 116 en el buzón contra 100 costeado y cree que hay descuadre.

Verificado antes de este plan:
- La cifra de la fila sale de `total_detectado` (atributo `Total` del CFDI) o, si el proveedor sólo mandó PDF, de `monto_declarado` que teclea operaciones.
- La tabla del buzón **no guarda subtotal** hoy; el lector de XML del navegador tampoco lo extrae, aunque el parser del servidor (`_shared/cfdiParser.ts`) sí lo hace.
- Documentos vivos: 5 por capturar (1 con XML), 113 capturadas (43 con XML), 23 rechazadas (8 con XML).

## Solución

1. **Guardar el subtotal del CFDI**: nueva columna `subtotal_detectado` en el buzón, llenada al subir el XML (se agrega `subTotal` al lector de XML del navegador).
2. **El buzón muestra el subtotal como cifra principal**, con la etiqueta "Sin IVA". El total con impuestos pasa a ser dato secundario en el tooltip ("Total con IVA: $X").
3. **Monto tecleado a mano sin IVA**: el campo de captura de monto (documentos sin XML) se renombra a "Monto sin IVA" con ayuda breve, y el buzón lo muestra igual, marcado como declarado.
4. **Documentos históricos**: se reprocesan los XML ya almacenados para llenar el subtotal, extendiendo el barrido de reparación del buzón que ya existe. Si un documento no tiene XML y sólo tiene total con IVA, se sigue mostrando ese número pero etiquetado "con IVA" para no inventar un subtotal.
5. Se mantiene el filtro "Sin importe" y el cotejo contra costos, que ahora comparan sin IVA contra sin IVA.

Sin cambios en la captura de la factura de proveedor ni en cálculos financieros: el subtotal es sólo un dato de referencia del buzón.

## Detalle técnico

- Migración: `ALTER TABLE public.embarque_facturas_entrantes ADD COLUMN subtotal_detectado numeric` + actualizar las RPC de alta/edición del buzón (`p_subtotal_detectado`) manteniendo compatibilidad con llamadas sin el parámetro.
- `src/lib/domain/cfdiXmlMeta.ts`: agregar `subTotal` a `CfdiXmlMeta` (atributo `SubTotal`), con prueba unitaria.
- `src/features/cxp/services/facturasEntrantesFila.ts` y `facturasEntrantesUploadAlta.ts`: persistir el subtotal.
- `src/features/bandejas/domain/facturasEntrantesBuzon.ts`: `importeEntrante()` devuelve `{ monto, moneda, fuente, conIva: boolean, totalConIva: number | null }` con prioridad subtotal CFDI → monto declarado → total CFDI (marcado `conIva`). Pruebas de los tres caminos.
- `FacturaEntranteRow.parts.tsx` (`ImporteEntrante`): etiqueta "Sin IVA" / "con IVA" y tooltip con el desglose; mismo tratamiento en `PreviaFacturaEntranteSheet.parts.tsx` y `entrantes/MetaEntrante.tsx`.
- `VerificacionMontoEntrante.tsx`: renombrar a "Monto sin IVA" y ajustar el texto de ayuda y el cotejo contra lo costeado.
- Backfill: extender `supabase/functions/backfill-cxp-buzon/backfill.ts` para leer el XML de `cxp-inbox` y llenar `subtotal_detectado` cuando esté vacío (idempotente, respetando el candado de organización y roles actual).
- `CHANGELOG.md` + `APP_VERSION` (bump menor).
