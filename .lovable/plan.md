# Pulido visual de PDFs generados — sistema unificado "Invoice-grade Libre Carga"

## Diagnóstico (por qué la cotización se ve mejor que la proforma)

Mirando los archivos como diseñador + contador:


| Aspecto           | Cotización                                                               | Proforma                                                                                                         | Veredicto                                   |
| ----------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Header            | `h1` 18pt + folio + badge estado, jerarquía limpia                       | `h1Xl` 26pt con `letterSpacing:2` "PROFORMA" + numero gris, badge warning amarillo + badge info azul lado a lado | Proforma se ve cargada y "ruidosa"          |
| Cierre de totales | `ResumenBox` con borde corporativo 2pt, jerarquía Subtotal → IVA → Total | Bloque `subtotalBlock` simple a la derecha, sin caja, repetido 2 veces (USD y MXN)                               | Proforma pierde foco visual                 |
| Branding emisor   | Sin logo (igual)                                                         | Sin logo (igual)                                                                                                 | Falta en ambos: no hay bloque "From/Emisor" |
| Datos cliente     | N/A (es prospecto)                                                       | 2 columnas razón social + RFC, luego dirección colgada fuera de grid                                             | Inconsistente                               |
| Iconografía       | Sin emojis                                                               | `📦 Contenedor: …` en consolidada                                                                                | Emoji rompe seriedad                        |
| Aviso fiscal      | N/A                                                                      | `warningBox` con borde dashed amarillo al final, parece sticker                                                  | Anti-profesional                            |
| Vigencia / pago   | N/A                                                                      | Sin vigencia, sin datos bancarios, sin método de pago                                                            | Falta contable crítico                      |
| Footer            | Texto plano centrado                                                     | Texto plano centrado                                                                                             | Sin marca, desperdiciado                    |


## Objetivo

Un solo sistema visual ("Libre Carga Invoice System") aplicado a los 5 PDFs del proyecto:

1. `CotizacionDocument`
2. `ProformaDocument`
3. `ProformaConsolidadaDocument`
4. `RentabilidadDocument`
5. `estadoCuentaPdf` (si existe en formato @react-pdf)

Refinar **componentes compartidos** (`theme/styles.ts`, `components/*`) para que el pulido aplique a todos automáticamente — no rediseño doc por doc.

## Cambios propuestos

### 1. Sistema de marca compartido (nuevo `components/BrandHeader.tsx`)

- Banda superior de 4pt color `primary` (acento corporativo en cada hoja).
- Bloque izquierdo: logo SVG (`public/librecarga-logo.svg`) a 32pt alto + razón social emisora + RFC + dirección + tel/email — leído de `configuracion` (org actual).
- Bloque derecho: tipo de documento (Cotización / Proforma / etc.) en `h1` 16pt uppercase, número/folio grande debajo, fila de meta (fecha emisión, vigencia, expediente, BL/MAWB) en grid 2 col compacto.
- Eliminar `h1Xl` 26pt con letterSpacing y la fila de badges sueltos.

### 2. Paleta y tipografía depuradas (`theme/styles.ts`)

- Mantener `primary` (#0F4C81). Retirar `primaryDark` (#1B2B4B) — fuente de inconsistencia: queda solo `ink` para texto y `primary` para acentos.
- Subir `border` de #DDDDDD → #E5E7EB (Tailwind slate-200, más moderno).
- `zebra` actual #F8FAFC ya es bueno; aplicar zebra real en filas pares de `DataTable` (hoy no se aplica).
- Letter-spacing en `h1Xl` baja de 2 → 0.5; tamaño de 26 → 20.
- Línea base de página: `paddingTop` 32 → 40 para dar aire bajo la banda superior.

### 3. `DataTable` — refinamiento

- Zebra striping real (filas pares con `backgroundColor: COLORS.zebra`).
- Header con `backgroundColor: primary` y texto blanco (más serio que el gris actual) — o variante "light" para cotización si se prefiere mantener.
- `borderBottom` de filas a 0.25pt (hoy 0.5, se ve marcado).
- Numeric cells con tabular-nums (Helvetica ya alinea, pero asegurar paddingRight 8 para que no peguen al borde).

### 4. Caja de totales unificada (`components/TotalesBox.tsx` nuevo)

- Reemplaza `subtotalBlock` + `ResumenBox` por un único componente:
  - Caja a la derecha (50% ancho), fondo blanco, borde 1pt `primary`.
  - Filas Subtotal / IVA (XX%) / **TOTAL** — última con fondo `primary` y texto blanco.
  - Soporta multi-moneda: dos cajas apiladas con separador, o una sola con secciones USD/MXN.
  - Tipo de cambio aplicado abajo (label pequeño) cuando hay conversión.

### 5. Bloque "Cliente / Facturar a" estandarizado (`components/BillToBlock.tsx`)

- Two-column layout: **Emisor** (izquierda) | **Cliente / Facturar a** (derecha).
- Razón social bold, RFC, dirección completa, contacto.
- Aplica a Proforma y Cotización (en cotización con prospectos sigue funcionando).

### 6. Bloque "Condiciones de pago" (solo Proforma)

Nuevo bloque obligatorio para que la proforma luzca como documento contable:

- Vigencia (calculada: fecha_emisión + 30 días, o configurable).
- Método de pago (Transferencia / Contado).
- Días de crédito.
- **Datos bancarios** (banco, cuenta, CLABE, beneficiario, SWIFT) — leídos de `configuracion` org.
- Moneda de pago.

Si no hay datos bancarios capturados en configuración, mostrar placeholder discreto "Solicitar datos al área de cobranza" en vez de ocultar el bloque.

### 7. Aviso "sin validez fiscal" rediseñado

- Quitar la caja dashed amarilla al final.
- Mover el aviso a una franja delgada bajo el header (3pt de alto, fondo `warningBg` suave, texto centrado 8pt) — visible siempre, no invasivo.
- Watermark diagonal opcional "PROFORMA" en gris muy claro (8% opacidad) en el centro de la página (sólo proformas).

### 8. Eliminar emojis de PDF

- `📦 Contenedor: …` → reemplazar por chip tipográfico: `[CONTENEDOR]` en small-caps con borde izquierdo `primary` 3pt, fondo `zebra`. Más limpio en impresión y consistente con `h3`.

### 9. Footer con marca

- Reorganizar `Footer.tsx` en 3 columnas:
  - Izquierda: logo mini (12pt) + "Libre Carga".
  - Centro: texto legal corto ("Documento generado el …").
  - Derecha: "Página X de Y".
- Línea superior 0.5pt `primary` (hoy `border` gris).

### 10. Espaciado y aire

- `h3` margin top 14 → 18, padding-bottom 3 → 5: secciones más respiradas.
- Subir line-height de page 1.4 → 1.45.
- Aumentar `paddingHorizontal` de 32 → 36 para que el contenido no toque el borde de impresión.

## Alcance fuera de este plan

- No se tocan los servicios de datos (`services/proforma.ts` etc.) ni los hooks. Cambios sólo en `src/pdf/**`, salvo lectura de configuración org para datos bancarios y emisor (un hook ya existente).
- No se modifica el formato CSV ni los PDFs de tracking.
- No se introduce librería de fuentes custom (sigue Helvetica built-in, 0 KB extra) — el pulido se logra por sistema, no por tipografía exótica.

## Validación

1. Renderizar Cotización en `/dev/pdf-preview/cotizacion/:id` y comparar antes/después.
2. Crear `/dev/pdf-preview/proforma/:id` y `/dev/pdf-preview/proforma-consolidada/:id` (no existen hoy) para QA visual con `PDFViewer`.
3. Convertir output a PNG (`pdftoppm -r 150`) y revisar página por página: overflow, alineación, colores, contraste. Se inspeccionarán los 5 documentos.
4. Verificar que tests existentes de `proforma` siguen verdes.

## Opción adicional (recomendada antes de implementar)

Antes de tocar código, puedo **generar 1 PNG de mockup** de la nueva Proforma (usando ReportLab o canvas-design) para que valides el look final. Toma ~2 min y evita iterar sobre el PDF real. Si prefieres ir directo a implementación, también está bien.

## Archivos a tocar

- `src/pdf/theme/styles.ts` (refactor de tokens + nuevos estilos)
- `src/pdf/components/BrandHeader.tsx` *(nuevo)*
- `src/pdf/components/BillToBlock.tsx` *(nuevo)*
- `src/pdf/components/TotalesBox.tsx` *(nuevo, reemplaza `ResumenBox`)*
- `src/pdf/components/PaymentTermsBlock.tsx` *(nuevo)*
- `src/pdf/components/DataTable.tsx` (zebra + header oscuro)
- `src/pdf/components/Footer.tsx` (3 cols + logo)
- `src/pdf/documents/CotizacionDocument.tsx` (usa nuevos componentes)
- `src/pdf/documents/ProformaDocument.tsx` (usa nuevos componentes + payment terms + watermark)
- `src/pdf/documents/ProformaConsolidadaDocument.tsx` (igual + remover emoji)
- `src/pdf/documents/ProformaHeader.tsx` (delete: lógica absorbida por BrandHeader + BillToBlock)
- `src/pdf/documents/RentabilidadDocument.tsx` (aplicar nuevos tokens)
- `src/pages/dev/PdfPreviewProforma.tsx` *(nuevo, opcional, para QA)*
- `CHANGELOG.md` + `src/constants/appVersion.ts` (bump patch `12.0.0-rc.1` → `12.0.0-rc.2`, según política de no salir de la ventana RC) + entrada en `src/pages/Changelog.tsx`.

¿Apruebas que primero genere el mockup PNG para validar dirección visual, o prefieres que implemente directo el sistema sobre los 5 documentos?  Implementa directo en sistema. 