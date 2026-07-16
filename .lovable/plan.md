
## Diagnóstico (analogía)

Es como enviar un paquete con la etiqueta de destinatario en el idioma equivocado: la paquetería lo acepta, pero la información nunca "cuadra" con el sistema del SAT. Al momento de cancelar la factura vieja pidiendo "sustitúyela por esta otra", el SAT contesta "esa sustituta no me consta que sustituya a nadie" → **"motivo no válido"**.

### Bug real

En `supabase/functions/facturapi-emitir/helpers.ts:167` estamos mandando:

```ts
payload.related_documents = [{ relationship: "04", documents: [ctx.sustituye_uuid] }];
```

Pero el SDK oficial `facturapi@4.18.0` (verificado en `dist/types/common.d.ts` y `invoice.d.ts`) declara el tipo así:

```ts
interface RelatedDocument { relationship: string; uuid: string }
```

FacturAPI v2 en **creación** espera `{ relationship, uuid }` (un objeto por UUID), no `{ relationship, documents: [...] }` (ese shape es lo que la API devuelve al *consultar*, agrupado). Como TypeScript no cachó el mismatch (usamos `payload: Record<string, unknown>` en `buildFacturapiPayload`), FacturAPI descarta el bloque silenciosamente al timbrar. Resultado: F988 quedó timbrada **sin relación 04 a F975**, por eso el SAT rechaza cancelar F975 con motivo 01.

Además, el pre-flight (`verificarRelacionSustitutaSAT`) sólo revisa `documents: string[]`; el shape real remoto es `documents: [{uuid, ...}]` (objetos), así que hubiera dejado pasar la petición aunque la relación existiera. Doble ceguera.

## Plan

### 1. Corregir el payload de emisión (raíz del bug)

**Archivo:** `supabase/functions/facturapi-emitir/helpers.ts`

- Cambiar el shape a `[{ relationship: "04", uuid: ctx.sustituye_uuid }]`.
- Ajustar el tipo local `related_documents` a `Array<{ relationship: string; uuid: string }>`.
- Añadir test en `helpers_test.ts` (si existe) que asegure el nuevo shape.

### 2. Endurecer pre-flight para soportar ambos shapes

**Archivo:** `supabase/functions/facturapi-cancelar/cancelacion.ts`

`verificarRelacionSustitutaSAT` debe reconocer **ambas** formas que puede devolver `retrieve`:
- `documents: string[]` (UUIDs)
- `documents: Array<{ uuid: string }>` (objetos)
- fallback `uuid: string` a nivel del bloque

Y añadir logging: si `retrieve` falla o si la relación no se encuentra, incluir en la bitácora el `related_documents` remoto tal cual, para futuros diagnósticos.

### 3. Retornar diagnóstico enriquecido al frontend cuando falle pre-flight

Cuando el pre-flight detecte que falta la relación 04, además del mensaje actual, devolver también `remote_related_documents` (el bloque crudo) para poder mostrarlo en el toast/dialog. UI opcional: agregar link "Consultar en FacturAPI" al toast de error de cancelación (ya existe el componente).

### 4. Guía al usuario para recuperar F975/F988

Como F988 ya se timbró con el shape incorrecto, **no existe relación 04 en el SAT**. El usuario tiene que:

1. Cancelar F988 con **motivo 02** ("errores sin relación") — F988 no tiene dependientes.
2. Volver a "Sustituir CFDI" desde F975 para generar una nueva sustituta (ya con el fix aplicado, quedará con la relación 04 correcta).
3. Cancelar F975 con motivo 01 apuntando a la nueva sustituta.

Se documentará este flujo de recuperación en el CHANGELOG.

### 5. Versionado y changelog

- `APP_VERSION` → `13.301.27`
- Entrada en `CHANGELOG.md` describiendo:
  - Bug del shape `related_documents` al timbrar sustitutas.
  - Pre-flight ampliado para reconocer ambos shapes remotos.
  - Nota de recuperación manual para facturas sustitutas timbradas antes del fix.

### 6. Verificación

- `bun run ci:fast` (lint + typecheck + vitest + deno tests) verde.
- Test unitario nuevo en `helpers.ts` de facturapi-emitir validando el shape `{relationship, uuid}`.

## Detalles técnicos

- SDK confirmado inspeccionando el tarball de `facturapi@4.18.0`:
  - `dist/types/common.d.ts:87` → `interface RelatedDocument { relationship: string; uuid: string }`
  - `dist/types/invoice.d.ts:64` → `related_documents?: RelatedDocument[] | null`
- El shape con `documents: [...]` sólo aparece en la respuesta de `GET /invoices/:id` (agrupado por relación).
- No se requiere migración de BD.
- No se toca la lógica de cancelación en sí (SDK call ya es correcta); todo el fix vive del lado del **timbrado** de la sustituta más las verificaciones/observabilidad.
