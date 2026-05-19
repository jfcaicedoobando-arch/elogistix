# Refrescar tabla de documentos tras subir/eliminar/agregar archivos

## Diagnóstico

La página `EmbarqueDetalle` lee los documentos vía `useEmbarqueDetalleData` → `useEmbarqueFull`, cuya clave de React Query es:

```
['embarques', 'full', id]
```

Pero las mutaciones de documentos en `src/hooks/embarque/mutations/useUpdateEmbarque.ts` (`useUploadDocumentoEmbarque`, `useDeleteDocumentoEmbarque`, `useCreateDocumentoEmbarque`) sólo invalidan:

```
queryKeys.embarques.documentos(embarqueId) === ['documentos_embarque', id]
```

Esa clave **no existe en esta página** (la lista de documentos viene dentro de la RPC `get_embarque_full`), así que React Query no refetchea y la UI sigue mostrando `Pendiente` hasta recargar manualmente. Por eso el estado parece "atorado" después de la subida exitosa.

## Solución

Hacer que las tres mutaciones de documentos también invaliden la query "full" del embarque. La forma más segura y mantenible es invalidar `queryKeys.embarques.all` (prefijo `['embarques']`), que cubre `['embarques', 'full', id]`, `['embarques', 'list', …]` y `['embarques', id]` sin tener que añadir una clave nueva al factory.

### Archivos a tocar

1. **`src/hooks/embarque/mutations/useUpdateEmbarque.ts`**
   - `useUploadDocumentoEmbarque.onSuccess`: añadir `queryClient.invalidateQueries({ queryKey: queryKeys.embarques.all })` además de la invalidación existente.
   - `useDeleteDocumentoEmbarque.onSuccess`: lo mismo.
   - `useCreateDocumentoEmbarque.onSuccess`: lo mismo (para que al crear un nuevo slot aparezca de inmediato).

2. **`src/constants/appVersion.ts`** → bump a `8.221.0`.

3. **`src/content/changelog/v8/chunks/0.ts`** y **`src/content/changelogData.ts`** → nueva entrada `8.221.0` describiendo el fix de refresco.

## Validación

- Subir un archivo a un documento: la fila debe pasar a `Recibido` sin recargar.
- Eliminar un documento subido: la fila debe volver a `Pendiente` (o desaparecer si fue agregada manualmente).
- Agregar un nuevo documento con "Agregar documento": debe aparecer en la tabla al instante.

## Detalles técnicos

- No hace falta tocar `useEmbarqueFullQuery` ni `queryKeys`. Sólo ampliar la invalidación.
- La invalidación es de prefijo, así que un único `invalidateQueries({ queryKey: ['embarques'] })` cubre la query full y cualquier lista de embarques que pueda mostrar contador de documentos.
- Mantengo también las invalidaciones específicas a `documentos_embarque` por si en el futuro algún hook las consume directamente.
