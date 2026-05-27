## Objetivo

Reemplazar el branding "Libre Carga" en todos los PDFs por los datos reales del emisor (hoy: **Elogistix Shipping**) leídos desde la tabla `configuracion` (categoría `empresa`), de modo que el cambio se propague a Cotización, Proforma, Proforma Consolidada y Rentabilidad sin volver a hardcodear ningún nombre.

## Fuente de verdad

Ya existe en BD:

```
configuracion (categoria='empresa') →
  nombre = "Elogistix Shipping"
  subtitulo = "Agente de Carga"
  rfc, direccion_fiscal, email, telefono
```

No se crea schema nuevo. La pantalla `/configuracion` ya permite editar estos campos vía `useConfiguracionState`, así que cambiar el nombre en el futuro será solo cuestión de editar ahí.

## Cambios

### 1. Nuevo loader del emisor para PDFs
- `src/pdf/emisor.ts` (nuevo): función `cargarEmisorEmpresa(): Promise<EmisorInfo>` que consulta `configuracion` (categoría `empresa`) y devuelve `{ razonSocial, subtitulo, rfc, direccion, email, telefono }`. Caché en memoria por sesión (TTL corto, ej. 5 min) para no pegarle a la BD en cada descarga. Fallback seguro si falla la consulta: `razonSocial = "Empresa"`, demás vacíos (nunca "Libre Carga").

### 2. `BrandHeader` deja de hardcodear marca
- `src/pdf/components/BrandHeader.tsx`:
  - Quitar `EMISOR_DEFAULT.razonSocial = "Libre Carga"` y la cadena `"LIBRE CARGA"` del JSX.
  - `brandMark` = `emisor.razonSocial.toUpperCase()`.
  - `brandSub` = `emisor.subtitulo` (en lugar del texto fijo "Soluciones logísticas internacionales").
  - Renderizar RFC / dirección / contacto solo si vienen poblados.
  - Si no se pasa `emisor`, mostrar placeholder neutro ("Empresa") en vez de "Libre Carga".
- `EmisorInfo` se amplía con `subtitulo` opcional.

### 3. `Footer` dinámico
- `src/pdf/components/Footer.tsx`: aceptar prop `empresaNombre` y reemplazar la cadena fija `"LIBRE CARGA"`. Si no se pasa, mostrar "Documento generado electrónicamente" sin nombre.

### 4. Documentos PDF reciben `emisor`
- `CotizacionDocument`, `ProformaDocument`, `ProformaConsolidadaDocument`, `RentabilidadDocument`:
  - Aceptan prop `emisor: EmisorInfo` (requerida).
  - Pasan `emisor` a `BrandHeader` y `emisor.razonSocial` a `Footer`.
  - `<Document author={emisor.razonSocial}>` en lugar de `"Libre Carga"`.
- `ProformaHeader.tsx`: mismo tratamiento (recibe `emisor` desde el documento).

### 5. Generadores async cargan emisor antes de renderizar
- `src/generators/cotizacionPdf.tsx`, `proformaPdf.tsx`, `rentabilidadPdf.tsx`:
  - Hacer la función `async`, llamar a `cargarEmisorEmpresa()` antes de `descargarPdf`, y pasar `emisor` al documento.
- Callers ya usan `await import(...)` y son async — solo añadir `await generarPdfX(...)`:
  - `src/pages/cotizaciones/CotizacionDetalle.tsx`
  - `src/hooks/embarque/useDialogGenerarProformaController.ts`
  - `src/hooks/embarque/useDescargarProformaPdf.ts`

### 6. Preview dev
- `src/pages/dev/PdfPreviewCotizacion.tsx` (y proforma si existe): cargar emisor con `useQuery` y pasarlo al documento, así QA visual refleja datos reales.

### 7. Limpieza de strings residuales
- Reemplazar el comentario `"Libre Carga Invoice System"` en `src/pdf/theme/styles.ts` por algo neutro (`"Sistema visual unificado de facturación"`).
- Comentarios en `BrandHeader.tsx`.

### 8. Versionado y changelog
- Bump `APP_VERSION` → `12.0.0-rc.3`.
- Entrada en `CHANGELOG.md` describiendo el cambio (datos del emisor leídos desde `configuracion.empresa`, eliminación del nombre hardcodeado).

## Fuera de alcance
- No se tocan plantillas de email, ni el sidebar/UI de la app (solo PDFs).
- No se agrega editor de logo ni se sube imagen de marca (se conserva el text-mark tipográfico).
- No se modifica el gate de GA ni se cierra el RC.

## Verificación
- `bunx vitest run` y `bunx eslint`.
- Abrir `/dev/pdf-preview-cotizacion` y descargar una proforma real desde un embarque: el header debe decir **ELOGISTIX SHIPPING** / **Agente de Carga** y el `author` del PDF también.
- Cambiar `empresa.nombre` en `/configuracion` y verificar que un nuevo PDF refleja el nuevo nombre tras invalidar la caché (recarga o esperar TTL).

## Archivos a tocar
- `src/pdf/emisor.ts` (nuevo)
- `src/pdf/components/BrandHeader.tsx`
- `src/pdf/components/Footer.tsx`
- `src/pdf/documents/CotizacionDocument.tsx`
- `src/pdf/documents/ProformaDocument.tsx`
- `src/pdf/documents/ProformaConsolidadaDocument.tsx`
- `src/pdf/documents/ProformaHeader.tsx`
- `src/pdf/documents/RentabilidadDocument.tsx`
- `src/pdf/theme/styles.ts` (solo comentario)
- `src/generators/cotizacionPdf.tsx`
- `src/generators/proformaPdf.tsx`
- `src/generators/rentabilidadPdf.tsx`
- `src/pages/cotizaciones/CotizacionDetalle.tsx`
- `src/hooks/embarque/useDialogGenerarProformaController.ts`
- `src/hooks/embarque/useDescargarProformaPdf.ts`
- `src/pages/dev/PdfPreviewCotizacion.tsx`
- `src/constants/appVersion.ts`
- `CHANGELOG.md`