## Diagnóstico

El botón **"Acuse PDF"** actualmente **genera un PDF cliente-side** (`AcuseCancelacionDocument`, un layout de Libre Carga con los datos guardados en BD). Por eso lo ves como "un archivo del ERP" — no es el PDF que emite FacturApi/SAT.

FacturApi sí expone el **PDF oficial** del acuse de cancelación en:

```
GET https://www.facturapi.io/v2/invoices/{facturapi_id}/cancellation_receipt/pdf
```

Sólo hay que consumirlo desde el backend (por CORS y para no exponer la API key) y entregar el binario al navegador.

## Cambio

### 1. Edge function `facturapi-cancelar` — modo "descargar acuse PDF"

Agregar un tercer modo (además del flujo normal y `solo_descargar_acuse: true`):

- Input: `{ factura_id, solo_descargar_acuse_pdf: true }`.
- La edge resuelve el cliente FacturApi por organización (multi-tenant), llama a `GET /invoices/{facturapi_id}/cancellation_receipt/pdf`, y devuelve el PDF como `application/pdf` en la respuesta (no lo guarda en BD).
- Errores: `404 → { error: "acuse_pdf_no_disponible" }` (el SAT aún no lo emitió); `no_timbrada` / `no_cancelada` como en el modo XML.
- Helper nuevo `descargarAcusePdf.ts` paralelo a `descargarAcuse.ts`, con la misma lógica pero devolviendo `ArrayBuffer`.

### 2. Cliente — `services/facturapi.ts`

Nueva función `descargarAcuseCancelacionPdf(facturaId)` que invoca la edge y devuelve un `Blob`.

### 3. Hook `useAcuseCancelacion`

Reemplazar la generación cliente-side por la descarga oficial:

- `descargarPdfAcuse` → invoca `descargarAcuseCancelacionPdf`, entrega el blob con `descargarBlob(...)` y nombre `acuse-cancelacion-{numero}.pdf`.
- Si la edge responde 404, mostrar toast: *"El SAT aún no ha emitido el acuse. Usa 'Reintentar acuse' e inténtalo más tarde."*
- Se **elimina** la ruta que usaba `AcuseCancelacionDocument`. El archivo `src/pdf/documents/AcuseCancelacionDocument.tsx` queda huérfano y se borra (junto con su import en `emisor`).

### 4. UI — sin cambios

El botón "Acuse PDF" sigue apareciendo cuando `acuse_cancelacion_status === 'accepted'` (que ya implica que el SAT emitió el acuse, por lo tanto Facturapi puede servir el PDF).

### 5. Housekeeping

- Bump `APP_VERSION` a `13.205.9`.
- Entrada en `CHANGELOG.md`.

## Fuera de alcance

- No se cachea el PDF en BD (Facturapi lo sirve on-demand y el XML ya está guardado como fuente de verdad).
- No se toca el flujo de "Reintentar acuse" (sigue re-descargando el XML).
- No se agrega al Portal Cliente.
