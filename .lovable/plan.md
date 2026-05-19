## Contexto y aclaración previa

Auditoría de los 4 archivos solicitados:

| Archivo | Implementación actual | Imperativo (jsPDF/html2canvas)? |
|---|---|---|
| `cotizacionPdf.ts` | Concatenación de HTML + `window.open` + `window.print()` | **No** |
| `proformaPdf.ts` | Idem (delega a `openPdfWindow` de `proforma/styles.ts`) | **No** |
| `rentabilidadPdf.ts` | Idem | **No** |
| `cotizacion/pdfShell.ts` | Helpers que devuelven strings de HTML/CSS | **No** |

No hay jsPDF, ni html2canvas, ni dibujado con coordenadas absolutas en el repo (`rg "jsPDF|html2canvas|jspdf"` vuelve vacío). La "directiva 1" se reinterpreta como **"erradicar el flujo de impresión HTML + window.print() y reemplazarlo por generación de PDF binario nativo con @react-pdf/renderer"**. Si la intención era otra, indícamelo.

## Dependencias nuevas

- `@react-pdf/renderer` (~Document/Page/View/Text/Image/StyleSheet, `pdf()`, `PDFViewer`, `PDFDownloadLink`).
- No requiere fuentes externas; usaremos las built-in (`Helvetica`/`Helvetica-Bold`) para evitar `Font.register` y network fetches. Si se desea Inter (token de marca), se registrará desde `/public/fonts/` en un segundo paso opcional.

## Restricciones de @react-pdf/renderer a tener presentes

1. **Sin CSS Grid**: el actual `display:grid; grid-template-columns: repeat(4,1fr)` debe migrarse a Flexbox (`flexDirection:'row'`, `flexWrap:'wrap'`, `width:'25%'`).
2. **Sin `<table>` HTML**: se construye con `<View>` (filas) + `<View>` (celdas) con `flex` y `border`.
3. **Text wrapping**: `<Text>` envuelve automáticamente. Para descripciones largas usaremos `wrap` en el `<View>` padre y `flexShrink:1` en la celda de descripción.
4. **Page break**: `<View break>` o `<Page>` separada en lugar de `.page-break`.
5. **Sin `display:flex` mixto** con `position` absoluto: layout puro Flexbox.

## Arquitectura propuesta

```text
src/pdf/
├── theme/
│   └── styles.ts           StyleSheet centralizado (colores marca, márgenes, tabla, headers)
├── components/
│   ├── Shell.tsx           <Page> base con padding, header logo + folio, footer fecha+marca
│   ├── KeyValueGrid.tsx    Reemplaza .grid (Flexbox 4 col, wrap)
│   ├── DataTable.tsx       Tabla genérica: columns[], rows[], alignments, borders
│   ├── Badge.tsx           Estado (Cotización/Proforma)
│   └── ResumenBox.tsx      Caja de totales con borde de marca
├── documents/
│   ├── CotizacionDocument.tsx     <Document><Page>... — recibe CotizacionRow + tasaIva
│   ├── ProformaDocument.tsx       Variante normal
│   ├── ProformaConsolidadaDocument.tsx
│   └── RentabilidadDocument.tsx
└── render/
    ├── descargarPdf.ts     Helper: `pdf(<Doc/>).toBlob()` + save-as
    └── PdfPreview.tsx      Wrapper <PDFViewer> para modo desarrollo
```

### StyleSheet centralizado (boceto)

```ts
// src/pdf/theme/styles.ts
import { StyleSheet } from '@react-pdf/renderer';
export const COLORS = {
  primary: '#0F4C81',
  ink: '#1A1A2E',
  muted: '#555555',
  border: '#DDDDDD',
  zebra: '#F8FAFC',
  badgeBg: '#E0E7FF',
  badgeFg: '#3730A3',
};
export const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: 'Helvetica', color: COLORS.ink },
  header: { flexDirection: 'row', justifyContent: 'space-between',
            borderBottomWidth: 3, borderBottomColor: COLORS.primary, paddingBottom: 12, marginBottom: 16 },
  h1: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: COLORS.primary },
  h3: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: COLORS.primary,
        borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingBottom: 3, marginBottom: 8, marginTop: 14 },
  gridRow: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  gridCell: { width: '25%', paddingHorizontal: 4, marginBottom: 6 },
  label: { fontSize: 8, color: COLORS.muted },
  value: { fontSize: 10, fontFamily: 'Helvetica-Bold' },
  tableHeader: { flexDirection: 'row', backgroundColor: COLORS.zebra,
                 borderTopWidth: 1, borderBottomWidth: 1, borderColor: COLORS.border },
  tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderColor: COLORS.border, minHeight: 18 },
  cell: { paddingVertical: 4, paddingHorizontal: 6, fontSize: 9 },
  cellDesc: { flexGrow: 1, flexShrink: 1 },         // wrap libre de descripciones
  cellNum: { width: 70, textAlign: 'right' },
  totalBox: { marginTop: 16, padding: 10, borderWidth: 2, borderColor: COLORS.primary, borderRadius: 6 },
  footer: { position: 'absolute', bottom: 16, left: 32, right: 32, textAlign: 'center',
            fontSize: 8, color: COLORS.muted, borderTopWidth: 0.5, borderTopColor: COLORS.border, paddingTop: 6 },
});
```

### Documentos (esqueleto)

```tsx
// src/pdf/documents/CotizacionDocument.tsx
import { Document, Page, View, Text } from '@react-pdf/renderer';
import { styles } from '../theme/styles';
import { Shell } from '../components/Shell';
import { KeyValueGrid } from '../components/KeyValueGrid';
import { DataTable } from '../components/DataTable';
import { ResumenBox } from '../components/ResumenBox';
import { buildDatosGenerales, buildMercancia } from '@/generators/cotizacion/datosGenerales';
// reutilizamos data builders (no son HTML, sólo arman pares label/value)
// los HTML builders se reemplazan; la lógica pura se conserva.

export function CotizacionDocument({ cotizacion, tasaIva }) {
  const totales = calcularTotales(cotizacion.conceptos_venta);
  const { usd, mxn } = splitConceptos(cotizacion.conceptos_venta);
  return (
    <Document title={`${cotizacion.folio} - Cotización`}>
      <Page size="LETTER" style={styles.page}>
        <Shell folio={cotizacion.folio} estado={cotizacion.estado} fecha={cotizacion.created_at}/>
        {/* Datos generales */}
        <Text style={styles.h3}>Datos Generales</Text>
        <KeyValueGrid items={buildDatosGenerales(cotizacion)}/>
        {/* Mercancía + Dimensiones */}
        <Text style={styles.h3}>Mercancía</Text>
        <KeyValueGrid items={buildMercancia(cotizacion)}/>
        {/* Salto explícito */}
        <View break/>
        <Text style={styles.h3}>Conceptos de Venta</Text>
        <DataTable
          columns={[
            { key:'descripcion', title:'Descripción', style: styles.cellDesc },
            { key:'cantidad', title:'Cant.', style: styles.cellNum },
            { key:'precio', title:'P. Unit.', style: styles.cellNum, align:'right' },
            { key:'total', title:'Total', style: styles.cellNum, align:'right' },
          ]}
          rows={usd.map(c => ({ ...mapearFila(c, 'USD') }))}
        />
        {/* MXN análogo */}
        <ResumenBox totales={totales} hayMxn={mxn.length>0}/>
        <Text style={styles.footer} fixed>
          Documento generado el {fechaEsMx()} — Libre Carga
        </Text>
      </Page>
    </Document>
  );
}
```

### Renderizado y descarga (reemplaza `window.print()`)

```ts
// src/pdf/render/descargarPdf.ts
import { pdf } from '@react-pdf/renderer';
export async function descargarPdf(elemento: JSX.Element, nombre: string) {
  const blob = await pdf(elemento).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${nombre}.pdf`; a.click();
  URL.revokeObjectURL(url);
}
```

### Preview en pantalla (entregable #4)

```tsx
// src/pdf/render/PdfPreview.tsx
import { PDFViewer } from '@react-pdf/renderer';
import { CotizacionDocument } from '../documents/CotizacionDocument';
export function CotizacionPdfPreview({ cotizacion, tasaIva }) {
  return (
    <PDFViewer style={{ width: '100%', height: '85vh', border: 0 }} showToolbar>
      <CotizacionDocument cotizacion={cotizacion} tasaIva={tasaIva}/>
    </PDFViewer>
  );
}
```

Se monta en una ruta dev `/dev/pdf-preview/cotizacion/:id` (lazy-loaded para no engordar el bundle principal). Permite verificar layout, wrap de descripciones largas y paginación antes de cablear botones de producción.

## Backward compatibility

Las firmas públicas se mantienen como **adaptadores delgados** para no tocar consumidores en una sola pasada:

```ts
// src/generators/cotizacionPdf.ts
import { descargarPdf } from '@/pdf/render/descargarPdf';
import { CotizacionDocument } from '@/pdf/documents/CotizacionDocument';
export function generarPdfCotizacion(cot, tasaIva = TASA_IVA) {
  return descargarPdf(<CotizacionDocument cotizacion={cot} tasaIva={tasaIva}/>, cot.folio);
}
```

Igual para `generarPdfProforma`, `generarRentabilidadPdf`. Consumidores afectados (sin cambios de API):
- `src/pages/cotizaciones/CotizacionDetalle.tsx`
- `src/hooks/embarque/useDescargarProformaPdf.ts`
- `src/hooks/embarque/useDialogGenerarProformaController.ts`
- `src/hooks/reportes/useReportesPageController.ts`

**Cambio de UX**: en lugar de abrir tab + dialog de impresión, se descarga `.pdf` directo. Si se requiere preservar el flujo "abrir en pestaña", uso `pdf(...).toBlob()` + `window.open(URL.createObjectURL(blob))`.

## Lo que NO entra en este alcance (a confirmar)

- `src/generators/estadoCuentaPdf.ts` — mismo patrón pero no listado en directivas. Recomiendo migrarlo en la misma PR para consistencia; lo dejo fuera salvo aprobación.
- `src/generators/proforma/consolidada.ts`, `header.ts`, `styles.ts` — necesarios para que `proformaPdf` siga funcionando; **sí entran** porque son parte del árbol del archivo objetivo.
- Registro de fuente Inter (token de marca) — opcional, queda como Phase 2.
- Tests visuales/snapshot de PDF — fuera de alcance (jsdom no monta canvas/PDF). Validación = inspección manual en `PDFViewer`.

## Fases de ejecución

1. **Phase 1 — Andamiaje**: instalar `@react-pdf/renderer`, crear `src/pdf/theme/styles.ts`, `Shell`, `KeyValueGrid`, `DataTable`, `ResumenBox`, `descargarPdf`, `PdfPreview`.
2. **Phase 2 — CotizacionDocument + ruta de preview** (`/dev/pdf-preview/cotizacion/:id`). **Entregable visible inmediato para que valides layout.**
3. **Phase 3 — ProformaDocument** (normal + consolidada) y refactor de `proformaPdf.ts` a adaptador.
4. **Phase 4 — RentabilidadDocument** y adaptador.
5. **Phase 5 — Limpieza**: borrar HTML helpers obsoletos (`cotizacion/pdfShell.ts`, `proforma/styles.ts:openPdfWindow`, etc.) una vez verificados los 3 documentos.
6. **Phase 6 — Versionado**: bump `APP_VERSION` a `10.2.0` (minor por cambio arquitectónico), actualizar `chunk0.ts` + `changelogData.ts`.

## Validación

- `bunx vitest run` debe seguir verde (no hay tests de PDF).
- Inspección manual en `/dev/pdf-preview/cotizacion/:id` con: (a) cotización con muchas filas; (b) descripciones de 200+ caracteres; (c) sin MXN; (d) sin notas; (e) prospecto.
- `rg "window\\.print|openPdfWindow|pdfStyles|buildHeaderHtml"` debe quedar vacío al final de Phase 5.

## Lo que NO se hace

- No se cambian las firmas `generarPdfCotizacion / generarPdfProforma / generarRentabilidadPdf`.
- No se agrega jsPDF ni html2canvas (no estaban; tampoco entran).
- No se registran fuentes externas en esta PR.
- No se modifica la lógica de cálculo (totales, IVA, profit) — sólo cambia el medio de renderizado.
