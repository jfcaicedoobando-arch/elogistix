## Contexto

Ayer arreglamos que las descargas de PDF/XML **desde el detalle de la factura** salieran con nombre descriptivo (`Factura_F975_Cliente_2026-07-21.pdf`) — primero cambiando el edge function `facturapi-descargar` y ayer exponiendo `Content-Disposition` vía CORS.

Me pediste revisar que "esto no pase" también en:
1. Los correos que le mandamos al cliente.
2. Los XMLs.

## Qué revisé

| Camino | Estado hoy | Acción |
|---|---|---|
| XML descargado desde detalle de factura (ícono ⬇️ XML) | Ya usa `buildFilename(...)` con `ext: "xml"` y ya recibe el fix de CORS `Access-Control-Expose-Headers` de ayer | ✅ Ya cubierto — no hay que tocar nada |
| Correo enviado por FacturApi (`facturapi-enviar-email`) | FacturApi arma y manda el correo con los adjuntos del lado de ellos; el nombre de los adjuntos lo controla FacturApi | ⚠️ Fuera de nuestro control — no se puede cambiar |
| Correo branded (`enviar-factura-email`) — el que usa la plantilla `factura-enviada` con links a PDF/XML firmados | ❌ **Gap real**: en `helpers.ts` línea 227–232 firma las URLs con `download: '${orgSlug}_Factura-${safeNumero}.{pdf,xml}'` (patrón viejo, sin cliente ni fecha, y sin distinguir NotaCredito/REP) | 🔧 Alinear al mismo formato |

Analogía: los archivos que el cliente descarga desde el detalle de la app ya llevan etiqueta clara; los que descarga desde el link del correo todavía llevan la etiqueta vieja de FedEx.

## Cambios propuestos

### 1) `supabase/functions/enviar-factura-email/helpers.ts`

En `prepareAttachments(...)`:
- Importar el helper compartido `buildFilename` de `../_shared/facturaFilename.ts` (ya existe, ya tiene tests Deno).
- Reemplazar la línea que arma el nombre a descargar:

```ts
// antes
signUrl(admin, pdfPath, `${orgSlug}_Factura-${safeNumero}.pdf`)
signUrl(admin, xmlPath, `${orgSlug}_Factura-${safeNumero}.xml`)

// después
const folioSerie = factura.numero || `${factura.serie ?? ""}${factura.folio_fiscal ?? ""}`;
signUrl(admin, pdfPath, buildFilename({
  tipo: "Factura",
  folioSerie,
  cliente: factura.cliente_nombre,
  fecha: factura.fecha_emision,
  ext: "pdf",
}))
signUrl(admin, xmlPath, buildFilename({ ... ext: "xml" }))
```

- Quitar la función local `sanitizeDownloadFilename` (queda muerta) si no la usa otro sitio; si sí, dejarla.
- `orgSlug` deja de ser prefijo del filename, pero se sigue usando en `basePath` del bucket (privado), así que se conserva la carga de `fetchOrgSlug`.

### 2) Tests

- Añadir un caso Deno en `helpers_test.ts` (si existe) que verifique que la URL firmada se pide con `download` = `Factura_F975_Cliente_Acme_2026-07-21.pdf` para un input controlado.
- El helper `buildFilename` ya tiene coverage propio, no se duplica.

### 3) Sin cambios

- `facturapi-descargar` — ya correcto (fix de ayer).
- `facturapi-enviar-email` — FacturApi controla los adjuntos.
- Plantilla de correo `factura-enviada` — sigue apuntando a `pdf_link` y `xml_link`; sólo cambia lo que el navegador guarda al hacer clic, no el link.
- Bucket `facturas-pdf` — sin cambios en policies ni en la ruta interna.

### 4) Versionado

- `APP_VERSION` → `13.303.93`.
- Entrada en `CHANGELOG.md` explicando que los links del correo branded ahora descargan con el mismo nombre descriptivo que el detalle.

## Notas técnicas

- El `download` de `createSignedUrl` mete el nombre en el `Content-Disposition` del response de Supabase Storage — ahí no hay problema de CORS porque el navegador navega directo al link (no es fetch cross-origin desde JS).
- `numero` en `facturas` suele venir tipo `F975`; si viene vacío, `serie + folio_fiscal` es fallback razonable (mismo criterio que `resolveFromFactura` en `facturapi-descargar`).
- Notas de crédito y REPs branded: hoy `enviar-factura-email` sólo maneja factura completa (no NC ni REP branded), así que no hay más callsites por migrar.
