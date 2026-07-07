
## Objetivo

Que el botón **"Descargar XML"** (y de paso "Descargar PDF") del correo de factura ejecute realmente una descarga en lugar de abrir el archivo en el navegador.

## Causa raíz

En `supabase/functions/enviar-factura-email/helpers.ts`, la función `signUrl(admin, path)` crea la URL firmada sin el parámetro `download`. Supabase responde con `Content-Type: application/xml` y sin `Content-Disposition`, por lo que Chrome/Safari/Firefox muestran el XML como página.

## Cambios

### 1. `supabase/functions/enviar-factura-email/helpers.ts`

**a)** Modificar `signUrl` para aceptar un `downloadFilename?: string` opcional. Cuando venga, pasarlo al SDK como tercer argumento:

```ts
export async function signUrl(
  admin: ReturnType<typeof createClient>,
  path: string,
  downloadFilename?: string,
): Promise<string> {
  const opts = downloadFilename ? { download: downloadFilename } : undefined;
  const { data, error } = await admin.storage
    .from('facturas-pdf')
    .createSignedUrl(path, SIGNED_URL_TTL, opts);
  if (error || !data) throw new Error(`Signed URL ${path}: ${error?.message}`);
  return data.signedUrl;
}
```

**b)** En `prepareAttachments`, armar nombres amigables (`Factura-<numero>.pdf` / `Factura-<numero>.xml`) y pasarlos:

```ts
const pdfFilename = `Factura-${factura.numero}.pdf`;
const xmlFilename = `Factura-${factura.numero}.xml`;
const [pdfLink, xmlLink] = await Promise.all([
  signUrl(admin, pdfPath, pdfFilename),
  signUrl(admin, xmlPath, xmlFilename),
]);
```

Sanear el número de factura para evitar caracteres inválidos en el nombre (regex `[^A-Za-z0-9._-]` → `_`).

### 2. Tests

- Actualizar/crear `supabase/functions/enviar-factura-email/helpers_test.ts` con un caso que verifique que `signUrl` es llamada con `{ download: 'Factura-XXX.xml' }` cuando se le pasa filename (mock del cliente Supabase).
- Test de saneado del nombre (por ejemplo `A/1024` → `A_1024`).

### 3. Retrocompatibilidad

- No requiere migración ni cambios en el bucket. Los correos ya enviados no se re-firman (siguen igual).
- Correos que se envíen a partir del deploy tendrán el header correcto automáticamente. XML se descarga; PDF también (algunos navegadores ya lo descargaban por el viewer built-in, ahora será consistente).

### 4. Changelog + versión

- Bump `APP_VERSION` a `13.209.0`.
- Entrada en `CHANGELOG.md`: "Correos de factura · el botón Descargar XML ahora fuerza la descarga del archivo en lugar de abrirlo en el navegador (parámetro `download` de Supabase Signed URLs). Aplica también a PDF."

## Archivos afectados

```text
supabase/functions/enviar-factura-email/helpers.ts       (mod, ~10 líneas)
supabase/functions/enviar-factura-email/helpers_test.ts  (mod o nuevo)
src/constants/appVersion.ts                              (bump)
CHANGELOG.md                                             (entrada)
```

## Fuera de alcance

- Cambiar el mecanismo de descarga a un proxy autenticado (`facturapi-descargar`). El bucket `facturas-pdf` ya guarda los archivos y las URLs firmadas expiran, así que sigue siendo seguro.
- Tocar el template `factura-enviada.tsx`. El fix es 100% en el backend.
- Correos que envía FacturAPI directamente (vía `facturapi-enviar-email` — endpoint `/invoices/<id>/email`). Esos correos son distintos y no se cambian aquí.
