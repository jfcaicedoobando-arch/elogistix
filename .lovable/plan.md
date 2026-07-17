## Problema

Al timbrar una factura por sustitución, FacturAPI rechaza el payload con:

> `"related_documents[0].uuid" is not allowed`

En un cambio previo (v13.301.27) el payload se envió como `[{ relationship: "04", uuid: "..." }]`. La API real de FacturAPI espera el shape agrupado: `[{ relationship, documents: ["<uuid>", ...] }]` — el `uuid` plano es de la versión antigua del SDK y ya no es aceptado por el endpoint de emisión.

## Cambios

### `supabase/functions/facturapi-emitir/helpers.ts`
- `FacturapiPayload.related_documents`: cambiar el tipo a
  ```ts
  Array<{ relationship: string; documents: string[] }>
  ```
- En la construcción del payload de sustitución (línea ~169):
  ```ts
  payload.related_documents = [
    { relationship: "04", documents: [ctx.sustituye_uuid] }
  ];
  ```
- Actualizar los comentarios que decían que la API espera `{ relationship, uuid }` (era incorrecto — sólo aplicaba al tipo interno del SDK antiguo).

### `supabase/functions/facturapi-cancelar/cancelacion.ts` (pre-flight motivo 01)
Ya lee ambos shapes al consultar la remota; verificar que la lógica de match del UUID cubra el bloque `documents: [uuid]`. Ajustar si sólo mira `.uuid`.

### Tests Deno
- `facturapi-emitir/helpers_test.ts` (si existe cobertura del bloque de sustitución): actualizar assertions para el nuevo shape.
- Si no existe test para sustitución, agregar uno mínimo que verifique:
  ```ts
  assertEquals(payload.related_documents, [
    { relationship: "04", documents: ["<UUID>"] }
  ]);
  ```

### Versionado
- `src/constants/appVersion.ts` → `13.301.34`.
- `CHANGELOG.md`: entrada con el fix, referencia al requestId `772664a6-f280-4ebd-979c-fa919b279947` y al mensaje `related_documents[0].uuid is not allowed`.

### Sentry
- Marcar el issue asociado (buscar por `JAVASCRIPT-REACT` o similar con el título del error) como `resolved` referenciando el commit y la versión.

## Verificación

1. `bun run ci:fast` para lint/typecheck/tests unit.
2. Deno tests de las edge functions afectadas: `deno test supabase/functions/facturapi-emitir/`.
3. Manual: reintentar el timbrado de la factura `9924813f-47c7-49c7-853c-6fd8a3f794ca` (borrador de sustitución). Debe pasar sin el error de `uuid is not allowed`.
