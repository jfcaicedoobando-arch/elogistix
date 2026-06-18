## Bug confirmado: tipo de contenedor como UUID en el PDF

Consulté COT-2026-0076 en BD: `tipo_contenedor = '8014e97d-37a6-4e99-9238-fd507543c340'` (UUID del catálogo `tipos_contenedor`). El generador del PDF lo imprime crudo:

- `src/generators/cotizacion/datosGenerales.ts` línea 49:
  ```ts
  m.push(['Tipo de Contenedor', c.tipo_contenedor || '-']);
  ```

El mismo bug se arregló en pantalla con `resolveTipoContenedorNombre` + `useTiposContenedor`, pero el PDF no lo consume. Resultado: el PDF descargado muestra `8014e97d-...` en lugar de "40' High Cube".

## Cambios

### 1. Fix tipo de contenedor en PDF
- `src/generators/cotizacion/datosGenerales.ts`:
  - `buildMercancia` acepta un segundo parámetro opcional `tiposContenedor: TipoContenedorCatalogo[]`.
  - Internamente usa `resolveTipoContenedorNombre(c.tipo_contenedor, tiposContenedor, '—')`.
- `src/pdf/documents/cotizacionSections.tsx`:
  - `SeccionDatosYMercancia` recibe y reenvía `tiposContenedor`.
- `src/pdf/documents/CotizacionDocument.tsx`:
  - Acepta prop `tiposContenedor` (default `[]`) y lo pasa hacia abajo.
- `src/generators/cotizacionPdf.tsx`:
  - Antes de renderizar, llama `fetchTiposContenedor(true)` (incluye inactivos por si el id está deshabilitado) y se lo pasa a `CotizacionDocument`. Promesas en paralelo con `cargarEmisorEmpresa()`.

### 2. Mejoras de layout

**Problema:** el `<View break />` antes de "Conceptos de Venta" fuerza salto duro aunque haya espacio sobrante en página 1; KeyValueGrid con `columns=4` genera celdas muy estrechas que truncan labels largos ("Tipo de Contenedor", "Días libres de almacenaje"); `BillToBlock` queda aislado mostrando sólo el nombre.

- **Quitar el `<View break />` forzado** (línea 126 de `CotizacionDocument.tsx`). React-PDF maneja paginación naturalmente; el título de Conceptos se mantiene unido a la primera fila con `wrap={false}` en un wrapper para evitar título huérfano.
- **KeyValueGrid: pasar Datos Generales y Mercancía a `columns={3}`** (no a 2 para no estirar la página). Más respiración, labels completos sin truncar.
- **Header de meta enriquecido**: además de Estado y Fecha, incluir Vigencia (`fecha_vigencia`) en `BrandHeader.meta`. Reduce el peso de la sección "Datos Generales" y pone la información que el cliente busca primero (¿hasta cuándo es válida?).
- **Resumen ejecutivo de ruta**: añadir un mini-bloque entre `BillToBlock` y `SeccionDatosYMercancia` con `Origen → Destino · Modo · Incoterm · Tránsito X días`. Lectura inmediata; los detalles siguen en Datos Generales.
- **Bloque Mercancía como sección visualmente distinta**: el `<Text style={styles.h3}>Mercancía</Text>` queda pegado al grid de Datos Generales. Añadir `marginTop` consistente (mismo estilo que la separación con "Conceptos de Venta") y un `wrap={false}` en el wrapper del título + primera fila para evitar que el encabezado quede al final de página.
- **Notas**: hoy van al final, sin separación; envolver en un `View wrap={false}` cuando el texto sea corto (< ~6 líneas) para mantenerlas en una sola página.

### 3. Verificación visual (obligatoria)

Después de cada cambio:
1. Generar PDF de COT-2026-0076 desde `/cotizaciones/.../` (botón "Exportar PDF").
2. Confirmar:
   - **Tipo de Contenedor** muestra el nombre legible (ej. "40' High Cube"), no el UUID.
   - **Vigencia** aparece en el encabezado.
   - **Resumen de ruta** aparece justo bajo el destinatario.
   - **Sin salto duro** antes de Conceptos: el flujo se llena natural.
   - **Sin labels truncados** en grids.
   - **Conceptos** y **Totales** siguen en orden, sin texto solapado.

### 4. Versionado
- `APP_VERSION` → `13.66.3`.
- Entrada en `CHANGELOG.md`: `fix(cotizacion-pdf-tipo-contenedor)` + `refactor(cotizacion-pdf-layout)`.

## Archivos afectados

- `src/generators/cotizacion/datosGenerales.ts` (fix tipo contenedor + signature)
- `src/pdf/documents/cotizacionSections.tsx` (pass-through prop)
- `src/pdf/documents/CotizacionDocument.tsx` (props, quitar break, layout)
- `src/generators/cotizacionPdf.tsx` (fetch tipos contenedor)
- `src/pdf/components/BrandHeader.tsx` (sin cambio si meta ya soporta items extra) — verificar
- `src/constants/appVersion.ts`, `CHANGELOG.md`
- Test nuevo: `src/generators/cotizacion/__tests__/datosGenerales.test.ts` ampliado: caso UUID con catálogo y caso UUID sin catálogo (devuelve `—`).