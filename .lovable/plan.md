# Auditoría visual del modal "Capturar factura de proveedor" — 1280 × 720

Captura hecha en el navegador a 1280 × 720 con el modal abierto en modo "Capturar a mano".

## Lo que se ve mal

```text
┌──────────────────────────────────────────────┐
│ Encabezado + chip Total            ~100 px   │
│ ¿CÓMO VAS A CAPTURAR? (3 tarjetas)  ~110 px  │
│ ─── cuerpo scrolleable ──── SOLO ~290 px ─── │  ← aquí vive todo el formulario
│ Barra de cuadre (2 renglones)        ~65 px  │
│ Pendientes + botones                 ~60 px  │
└──────────────────────────────────────────────┘
```

1. **El cuerpo útil queda en ~290 px.** En la columna derecha sólo alcanza a verse hasta la etiqueta "Moneda": Subtotal/IVA/IEPS/Retenciones, Categoría contable y Notas exigen scroll a ciegas. En una pantalla de 720 px el modal se siente como una rendija.
2. **Fecha de emisión truncada:** el input muestra `05/08/20` porque el icono + la "x" de limpiar comen ancho en una columna de 3 campos.
3. **Desbalance de columnas:** en modo manual la izquierda queda casi vacía (título + un botón "Agregar concepto" y 200 px de aire) mientras la derecha necesita scroll. En 1280 se desperdicia la mitad del ancho.
4. **La banda de origen pesa demasiado para pantallas bajas:** tres tarjetas con título + ayuda de dos renglones cuestan ~110 px que ya no vuelven.
5. **La barra de cuadre gasta dos renglones cuando no hay nada que cuadrar** ("Aún no hay conceptos capturados" + su ayuda), aun con 0 conceptos y subtotal 0.

## Qué cambiar

**A. Recuperar alto (lo más importante)**
- Subir el techo del modal en pantallas bajas: `max-h-[92vh]` → alto casi completo con márgenes mínimos, para que el cuerpo pase de ~290 px a ~420 px sin tocar el diseño.
- Banda de origen en modo compacto cuando la altura es corta: mantener las 3 tarjetas, pero en una sola línea (icono + título + badge) y mover la frase de ayuda al `title`/tooltip. Ahorra ~45 px.
- Barra de cuadre en un solo renglón cuando el estado es `sin_conceptos`: dejar sólo "Aún no hay conceptos capturados" con los totales a la derecha y colgar la ayuda del desplegable ya existente.

**B. Aprovechar el ancho**
- En `lg` y arriba, cuando el origen es manual, mover "Moneda e importes" y "Fechas y crédito" a la columna izquierda debajo de partidas, dejando la derecha para Proveedor/Folio + Categoría + Notas; así ninguna columna queda hueca ni obliga a scroll largo.
- Alternativa más simple si se prefiere no reordenar: llevar Subtotal/IVA/IEPS/Retenciones a un grid de 4 columnas más angosto y subir Categoría contable, para que el bloque crítico entre en el primer pantallazo.

**C. Detalles**
- Dar más ancho al campo de emisión (grid `1.2fr .8fr 1fr` en Fechas y crédito) para que la fecha se lea completa.
- Estado vacío de partidas con una línea de guía ("Agrega partidas o sube el XML para que se llenen solas") en vez de aire.

## Notas técnicas
- Archivos: `src/components/shared/FormDialogShell.tsx` (alto), `src/features/cxp/components/OrigenDocumentoPicker.tsx` (modo compacto), `CuadreConceptosBar.tsx` (renglón único en `sin_conceptos`), `DialogNuevaFacturaProveedor.columnas.tsx` (reparto de bloques y grid de fechas).
- Sin cambios de lógica: los hooks (`useNuevaFacturaProveedorForm`) y el cálculo de cuadre quedan intactos.
- Verificación: captura Playwright a 1280 × 720 y 1920 × 1080 antes/después, más las pruebas ya existentes del modal.
- Se registra en `CHANGELOG.md` y se sube `APP_VERSION` a 13.423.0.
