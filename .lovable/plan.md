## Diagnóstico

El error `"related" is not allowed` es exactamente el mismo bug que corregimos ayer en la versión **13.300.57**. En el reporte que compartes, la telemetría dice `"version": "13.300.56"` — o sea, esa captura vino del build **anterior** al fix.

Ya revisé el código actual (`supabase/functions/facturapi-emitir/helpers.ts` línea 167) y confirma la forma correcta según la documentación oficial de FacturAPI v2:

```ts
payload.related_documents = [{ relationship: "04", documents: [ctx.sustituye_uuid] }];
```

La doc de FacturAPI (`createInvoice`, campo `related_documents: Array of RelatedDocumentInput`) confirma que ese es el esquema válido. El campo `related` sin sufijo ya no existe en la v2.

**Analogía:** es como cuando actualizas una app en el celular pero sigues viendo la pantalla vieja porque no la cerraste — el arreglo ya está guardado, pero el navegador (o los logs) aún muestra la versión previa.

## Qué hacer

1. **Publicar la versión actual (13.300.57)** desde el botón *Publish* en Lovable. Producción (`librecarga.com`) sigue sirviendo el bundle 13.300.56.
2. Refrescar la pestaña con Ctrl+F5 (para tirar el JS viejo cacheado) y reintentar la sustitución.
3. Si vuelve a fallar con la **misma versión 13.300.57 visible en el nuevo reporte de error**, entonces sí hay un bug remanente y abro una nueva ronda de investigación:
   - Revisar si el SDK oficial `facturapi@4.18.0` está transformando `related_documents` → `related` internamente (poco probable, pero verificable inspeccionando `node_modules/facturapi/lib/resources/Invoice.js`).
   - Agregar un `console.log` del payload final justo antes de `facturapi.invoices.create(payload)` para confirmar qué se está enviando en runtime.

## No requiere cambios de código todavía

Prefiero no bumpear a 13.300.58 con cambios especulativos. Primero necesitamos confirmar que el error persiste con la 13.300.57 ya publicada.

<presentation-actions>
<presentation-open-publish>Publish your app</presentation-open-publish>
</presentation-actions>
