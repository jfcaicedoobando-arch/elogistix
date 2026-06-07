# Mockear PDFs globalmente para eliminar OOM en la suite

## Problema

11 tests bajo `src/pdf/documents/__tests__/` declaran cada uno su propio `vi.mock("@react-pdf/renderer", async () => { const actual = await vi.importActual(...) })`. Aunque luego sobrescriben `Document/Page/View/Text`, `importActual` **sí ejecuta el módulo real**, cargando `fontkit`, `pdfkit` y polyfills de stream. Esto:

- Infla la carga inicial de cada archivo ~200–400 ms.
- Deja caches en `Font._fontkit` que el teardown actual limpia parcialmente.
- Es la causa raíz del OOM intermitente al correr la suite completa.

## Solución

Reemplazar el módulo real por un stub ligero vía alias de Vite, una sola vez. Los tests siguen funcionando sin tocar uno por uno (los `importActual` resuelven al stub).

## Pasos

### 1. Crear stub compartido `src/test/mocks/reactPdfStub.tsx`

Exporta primitivas ligeras que cubren toda la API usada por la app:
- Componentes: `Document, Page, View, Text, Image, Link, Svg, G, Path, Rect, Circle, Line, Polygon` → divs/elementos SVG con `data-testid`.
- `StyleSheet.create/flatten` → identidad.
- `Font.register/registerHyphenationCallback/registerEmojiSource/clear` → no-ops.
- `pdf()` → objeto con `toBlob/toBuffer/toString` que devuelven valores vacíos (necesario para `descargarPdf.test.ts`).
- `PDFViewer, PDFDownloadLink, BlobProvider` → wrappers de div.

### 2. Aliasar en `vitest.config.ts`

En `resolve.alias`, añadir:
```ts
"@react-pdf/renderer": path.resolve(__dirname, "./src/test/mocks/reactPdfStub.tsx"),
```
Esto hace que **toda** importación (directa o vía `importActual`) resuelva al stub.

### 3. Limpiar mocks locales redundantes (11 archivos)

En cada uno de los siguientes, eliminar el bloque `vi.mock("@react-pdf/renderer", ...)` (ya no hace nada útil porque el alias resuelve primero al stub):

- `src/pdf/documents/__tests__/CotizacionDocument.test.tsx`
- `src/pdf/documents/__tests__/ProformaConsolidadaDocument.test.tsx`
- `src/pdf/documents/__tests__/ProformaDocument.test.tsx`
- `src/pdf/documents/__tests__/ProformaHeader.test.tsx`
- `src/pdf/documents/__tests__/RentabilidadDocument.test.tsx`
- `src/pdf/documents/__tests__/ReporteCarteraDocument.test.tsx`
- `src/pdf/documents/__tests__/ReporteEERRDocument.test.tsx`
- `src/pdf/documents/__tests__/ReporteEjecutivoDocument.test.tsx`
- `src/pdf/documents/__tests__/ReportePresupuestoDocument.test.tsx`
- `src/pdf/documents/__tests__/ReporteTesoreriaDocument.test.tsx`
- `src/pdf/documents/__tests__/cotizacionSections.test.tsx`
- `src/pdf/render/__tests__/pdfRenderLeak.test.tsx`

Los `getByTestId("pdf-doc")` etc. siguen funcionando porque el stub usa los mismos `data-testid`.

### 4. Verificar

- Correr la suite completa (`vitest run`) → 0 fallos, 0 OOM, wall-clock reducido.
- Confirmar que el canary `pdfRenderLeak.test.tsx` sigue verde (mide heap delta sobre el stub, sigue siendo válido como regresión de fuga arquitectónica).
- Revisar que `descargarPdf.test.ts` siga pasando con `pdf().toBlob()` mockeado.

### 5. Versionado

- Bump `APP_VERSION` → `12.60.23`.
- Entrada en `CHANGELOG.md`.

## Resultado esperado

- Eliminación del OOM en suite completa.
- Wall-clock adicional reducido (~2–4 min menos por no cargar fontkit×11).
- Una sola fuente de verdad para mocks de PDF (`src/test/mocks/reactPdfStub.tsx`).
- Tests más limpios (menos boilerplate por archivo).

## Riesgos / mitigación

- **Riesgo**: algún test futuro espera renderizar el PDF real. → Mitigación: documentar en el stub que si se necesita el módulo real, usar `vi.doUnmock` o un test dedicado fuera del alias (config separada).
- **Riesgo**: el canary de fuga pierde sentido. → Sigue siendo útil como regresión: detecta fugas en árboles React/RTL aunque el renderer sea stub.
