

## Plan: Botón Exportar PDF en CotizacionDetalle

### Enfoque

Usar la API nativa del navegador `window.print()` con una vista de impresión dedicada, sin dependencias externas. Se crea una función que genera un HTML con los datos de la cotización (Datos Generales, Mercancía, Conceptos de Venta) y lo abre en una ventana nueva para imprimir/guardar como PDF.

### Cambios

**1. Crear `src/lib/cotizacionPdf.ts`**
- Función `generarPdfCotizacion(cotizacion: CotizacionRow)` que:
  - Construye un documento HTML con estilos inline para impresión
  - Encabezado: folio, cliente/prospecto, estado, fecha
  - Sección Datos Generales: modo, tipo, incoterm, moneda, origen, destino, vigencia, operador, y campos condicionales (tránsito, seguro, etc.)
  - Sección Mercancía: tipo embarque, contenedor, carga, sector, dimensiones LCL/aéreas si aplica
  - Sección Conceptos de Venta: tabla con descripción, cantidad, precio unitario, total + subtotal
  - **NO incluye** Costos Internos (P&L)
  - Abre `window.open()` con el HTML y ejecuta `window.print()`

**2. Modificar `src/pages/CotizacionDetalle.tsx`**
- Importar `generarPdfCotizacion`
- Agregar botón "Exportar PDF" con icono `FileDown` en la barra de acciones (junto al badge de estado)

**3. Actualizar `src/pages/Changelog.tsx`**
- Versión 4.5.4: Botón de exportación a PDF en cotizaciones

