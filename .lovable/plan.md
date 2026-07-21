# Extracción por IA de facturas PDF (proveedores internacionales)

Actualmente el modal "Nueva factura de proveedor" tiene dos modos: **Captura manual** y **Cargar XML CFDI (México)**. Este plan agrega un tercer modo **Cargar PDF (Internacional)** que usa Lovable AI (Gemini) para extraer cabecera y conceptos del PDF y prellenar el formulario igual que hace el CFDI.

## Alcance

- Solo se activa cuando el proveedor seleccionado es **internacional** (no MX) — cuando el proveedor es mexicano se sigue mostrando XML CFDI.
- El PDF se guarda como adjunto de la factura (misma ruta de storage que usa el PDF opcional del CFDI hoy).
- El usuario **siempre** revisa/edita los campos extraídos antes de guardar. La IA prellena, no aprueba.

## UX del modal

`CargaCfdiSection.tsx` pasa a tener 3 pestañas condicionales:

```text
┌─ Manual ─┬─ XML CFDI (MX) ─┬─ PDF por IA (Intl) ─┐
```

- Cuando `proveedor.pais_codigo === "MX"` (o no hay proveedor aún): se muestran Manual + XML.
- Cuando proveedor internacional: se muestran Manual + PDF por IA. El toggle recuerda selección.
- Dropzone del PDF (máx 10 MB, `application/pdf`), botón "Procesar con IA" con spinner.
- Al terminar: banner verde igual al de CFDI ("PDF procesado. Los campos fueron prellenados — puedes editarlos.") + los conceptos se listan en la tabla ya existente.

## Backend: nueva Edge Function `parse-invoice-pdf`

Nueva función `supabase/functions/parse-invoice-pdf/index.ts`:

1. Recibe `multipart/form-data` con `pdf` y `categorias[]` (mismo contrato que `parse-cfdi-xml`).
2. Valida JWT, tamaño ≤ 10 MB, MIME `application/pdf`.
3. Convierte a base64 y llama a Lovable AI Gateway (`google/gemini-3.5-flash`) vía `/v1/chat/completions` con contenido multimodal `{type:"file", file:{filename, file_data:"data:application/pdf;base64,..."}}` y **structured output** (tool call con `strict:true`) usando este schema:

   ```json
   {
     "invoice": {
       "invoice_number", "issue_date" (ISO YYYY-MM-DD),
       "currency" (ISO 4217), "exchange_rate" (nullable),
       "subtotal", "tax_total", "retention_total", "total",
       "supplier": { "name", "tax_id" },
       "customer": { "name", "tax_id" },
       "line_items": [{ "description", "quantity", "unit_price", "amount", "tax", "retention" }]
     },
     "ai": { "categoria_id" (nullable), "notas" }
   }
   ```

4. Mapea la respuesta al mismo shape que `CfdiParsedResponse` (adaptando `uuid=""`, `serie=""`, `folio=invoice_number`, `emisor.rfc=tax_id`, etc.) para que el hook `useNuevaFacturaProveedorForm` funcione sin cambios.
5. Devuelve JSON con breadcrumbs de Sentry, timeouts y manejo 402/429 idénticos a `parse-cfdi-xml`.

## Frontend

Archivos nuevos:

- `src/features/cxp/services/parsePdfInvoice.ts` — cliente HTTP con misma estructura que `parseCfdi.ts` (reintentos, `CfdiUploadError` reutilizado o nuevo `PdfInvoiceUploadError`).
- `src/features/cxp/services/parsePdfInvoice.invoke.ts` — single-attempt invoker.
- `src/features/cxp/hooks/useCargaPdfIa.ts` — espejo de `useCargaCfdi` para PDF (validación, timeout 30s por PDF).
- `src/features/cxp/components/CargaPdfIaSection.tsx` — dropzone PDF + botón procesar.

Cambios:

- `CargaCfdiSection.tsx` → renombrar a `CargaFacturaSection.tsx` (envoltura con 3 tabs) o agregar la tercera pestaña. Mantener < 200 líneas extrayendo cada tab a su propio archivo.
- `DialogNuevaFacturaProveedor.tsx` → pasar `proveedor?.pais_codigo` para decidir qué pestañas mostrar; mantener export estable.
- `useNuevaFacturaProveedorForm.ts` → aceptar `origen: "manual" | "cfdi" | "pdf_ia"` y guardar el flag en `factura_proveedor.origen_carga` para trazabilidad.

## Base de datos

Migración: agregar columna `origen_carga text default 'manual' check (origen_carga in ('manual','cfdi','pdf_ia'))` a `factura_proveedor`. Esto permite auditar y contar cuántas facturas se capturan por IA.

## Storage / adjuntos

Reutilizar el bucket y carpeta actuales del PDF opcional del CFDI. El PDF procesado por IA se guarda con el mismo naming `{Tipo}_{FolioSerie}_{Cliente}_{Fecha}.pdf`.

## Copy

- Título de pestaña: **PDF por IA** · Badge `Internacional`.
- Ayuda: "Sube el PDF de la factura del proveedor extranjero. La IA extraerá folio, fechas, moneda, subtotales y conceptos. Revisa siempre los campos antes de guardar."
- Toast éxito: "Factura procesada por IA — revisa los datos antes de guardar".
- Errores 402/429 con mensaje humano existente.

## QA

- Test unitario de mapeo Gemini→`CfdiParsedResponse` con fixture de invoice en inglés y en chino.
- Test del hook `useCargaPdfIa` (mock del edge, timeout, error 402).
- Test de que el toggle esconde XML cuando `pais_codigo !== "MX"`.
- Verificación manual: subir un PDF real de proveedor USD, confirmar prellenado, editar un concepto, guardar, ver `origen_carga='pdf_ia'` y el PDF en storage.

## Detalles técnicos

- Modelo: `google/gemini-3.5-flash` (rápido, multimodal, gratis vía Gateway). Fallback opcional a `google/gemini-2.5-pro` si el schema strict falla.
- Tokens: PDFs > 20 MB rechazados; > 50 páginas advertencia (Gemini soporta pero se degrada).
- Reintentos: 3 con backoff 1s/3s (igual que CFDI).
- Sin cambios en RLS ni en el flujo de aprobación posterior.
- `APP_VERSION` bump + entrada en `CHANGELOG.md`.

## Fuera de alcance

- OCR de facturas escaneadas de baja calidad (Gemini lo hace nativamente, pero no se agrega postproceso manual).
- Detección automática de duplicados por número de factura extranjera (se puede añadir después con índice único sobre `emisor_rfc + folio`).
- Auto-aprobación: siempre requiere revisión humana.
