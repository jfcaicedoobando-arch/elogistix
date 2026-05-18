# Bug: Subir el mismo archivo en otro slot deja el documento en "Pendiente"

## Diagnóstico

Verifiqué en la base de datos el embarque `18d1590b…`:

- **Bill of Lading (BL House)** (`3657da20…`): `archivo = NULL`, `estado = Pendiente` ← lo que Valeria acaba de "subir".
- **Certificado de Origen** (`a5c96ba7…`): tiene asignado el archivo `…SZSD25120685_OHBL_COPY_2.pdf` (de una prueba anterior).
- En `idempotency_keys` existe una entrada `fn = upload_documento_embarque` con `hits = 14` cuyo `response.path` apunta al docId de **Certificado de Origen**.

### Causa

En `src/services/embarque/documentos.ts`, la clave de idempotencia se calcula así:

```ts
const hash = await sha256Hex(file);         // depende SOLO del contenido
const requestId = hexToUuid(hash);          // misma clave para el mismo archivo
const { data: claim } = await supabase.rpc('idempotency_claim', { _key: requestId, ... });
```

Como la clave depende únicamente del contenido del archivo, al reutilizar el mismo PDF en otro slot (BL House vs Certificado de Origen), `idempotency_claim` devuelve la **respuesta cacheada del docId anterior**, la función retorna `cached: true` con el path viejo y **nunca toca la fila del nuevo documento**. El toast verde aparece porque no hubo error, pero BL House sigue en `Pendiente`.

Esto también explica por qué el archivo "ya estaba en Storage": el path es `embarques/{embarqueId}/{docIdViejo}/…` y no choca con el path del nuevo docId.

## Solución

Hacer que la clave de idempotencia identifique **(embarque + documento + contenido)**, no sólo el contenido:

1. **`src/services/embarque/documentos.ts`**
   - Cambiar el cálculo de `requestId` para combinar `embarqueId`, `docId` y el hash del archivo antes de derivar el UUID (por ejemplo, `sha256Hex` sobre `${embarqueId}:${docId}:${hash}` y luego `hexToUuid`).
   - Añadir el parámetro `embarqueId` a la firma de `uploadDocumentoEmbarque` (ya disponible en el hook que la invoca).
   - Como salvaguarda, después del `update`, usar `.select('id').single()` para detectar 0 filas afectadas y lanzar un error claro ("no se pudo actualizar el documento") en vez de devolver éxito silencioso.

2. **`src/hooks/embarque/useEmbarques.ts`** (o donde esté `useUploadDocumentoEmbarque`)
   - Pasar `embarqueId` al llamar `uploadDocumentoEmbarque(embarqueId, docId, file)`. El hook ya recibe `embarqueId` en `mutateAsync({ embarqueId, docId, file })`.

3. **Limpieza puntual de datos** (migración SQL)
   - Borrar la entrada huérfana en `idempotency_keys` con `key = '5c737f3c-747d-f24c-8e99-68f2bc44fdaa'` para que Valeria pueda volver a subir el mismo PDF a BL House sin tropezar con el caché viejo.
   - Limpiar el archivo asignado por error a "Certificado de Origen" (`a5c96ba7…`): poner `archivo = NULL`, `estado = 'Pendiente'`. El objeto en Storage puede dejarse o borrarse manualmente.

4. **Versión y changelog**
   - Bump a `8.220.0` en `src/constants/appVersion.ts`.
   - Entrada en `src/content/changelog/v8/chunks/0.ts` y `src/content/changelogData.ts` describiendo el fix.

## Validación

- Verificar con una subida real de Valeria que: el PDF se sube, BL House pasa a `Recibido` con el `archivo` correcto, y volver a subir el mismo PDF al mismo slot sigue siendo idempotente (no duplica).
- Verificar que subir el mismo PDF a otro slot también funciona y actualiza la fila correcta.

## Detalles técnicos relevantes

- `idempotency_keys` no tiene UPDATE/DELETE vía RLS para usuarios; la limpieza debe ir como migración SQL.
- `supabase.update(...).eq('id', docId)` sin `.select()` no devuelve error cuando afecta 0 filas; por eso conviene el `.select().single()` defensivo.
- El path en Storage seguirá conteniendo el hash, así que sigue siendo estable y deduplicado por contenido dentro del mismo `(embarque, docId)`.
