## Diagnóstico visual (F975, FullHD, sidebar abierto)

Muestreando los nodos de texto de la página encontré **6 tamaños distintos** (11, 12, 14, 16, 18 y 24 px), **4 pesos** (400/500/600/700) y **dos grises casi idénticos** (`rgb(18,27,43)` y `rgb(20,29,46)`) que se usan indistintamente. Eso genera una sensación de "ruido tipográfico" aunque cada carta individual se vea limpia.

Problemas concretos que se ven en las capturas:

1. **Títulos de tarjeta inconsistentes.**
  - Emisor / Receptor / Datos generales / Timbrado fiscal → 18 px, peso 600, con icono.
  - Desglose de conceptos / Totales / Historial de pagos / Notas de crédito / Historial de la factura → 16 px, peso 700, algunos sin icono.
   Son "hermanos" jerárquicamente pero se ven como niveles distintos.
2. **Etiquetas de campo inconsistentes.**
  - En Receptor, las etiquetas ("Cliente", "RFC", "Código postal", "Régimen fiscal", "Uso CFDI por defecto") son 12 px / 400 con un check verde delante.
  - En Datos generales y Timbrado fiscal las etiquetas son 12 px / 500 sin icono.
   Mismo rol, dos tratamientos.
3. **Dos grises de cuerpo indistinguibles.** `#121B2B` y `#141D2E` conviven en textos primarios; a ojo son el mismo color pero rompen el token semántico.
4. **Salto de tamaño en Totales.** Subtotal / IVA muestran valor a 16 px / 700, pero Total salta a 24 px / 700 y además cambia a azul. La jerarquía se entiende, pero el salto (16 → 24) es demasiado grande dentro de la misma fila de KPIs y compite con el USD 6,320.00 del header, que también está a 24 px.
5. **Header vs. card duplicados.** El total aparece dos veces a 24 px azul (arriba a la derecha y en la tarjeta Totales). Uno de los dos debería ceder tamaño.
6. **Micro-inconsistencia de números.** El "Folio 975" del bloque Timbrado fiscal y el "60" de "Días de crédito" usan 14 px / 500, mientras que UUID / RFC (mismo rol de "dato monoespaciado") usan 14 px / 500 mono. Está bien, pero el UUID se ve más pesado por la fuente mono; conviene bajarle un nivel visual.

## Propuesta: una escala tipográfica de 4 niveles

Toda la página vive con estos tokens (no se inventan colores ni fuentes, solo se aplican los ya existentes en `index.css`):

```text
display   24 / 700   foreground             → total del header
h-card    16 / 600   foreground             → TODOS los títulos de tarjeta
label     12 / 500   muted-foreground upper → TODAS las etiquetas de campo
value     14 / 500   foreground             → TODOS los valores
value-mx  14 / 600   foreground             → totales/KPIs destacados
mono      13 / 500   foreground (font-mono) → UUID, RFC, folios
```

Con esa escala desaparecen los tamaños 11 y 18 px, y se unifica el peso de los títulos.

## Cambios concretos

1. **Unificar títulos de tarjeta a `h-card` (16 / 600, con icono a la izquierda).**
  Tocar los `CardHeader` de: `TabResumen` (Emisor, Receptor, Datos generales, Timbrado fiscal) y `FacturaDetalleView` (Desglose de conceptos, Totales, Historial de pagos, Notas de crédito, Historial de la factura). Todos con el mismo componente wrapper para que no vuelvan a divergir.
2. **Unificar etiquetas a `label` (12 / 500, `text-muted-foreground`, uppercase tracking-wide opcional).**
  Sacar el check verde delante de las etiquetas de Receptor: el check corresponde al valor validado (RFC verificado), no a la etiqueta. Se mueve como badge junto al valor o se quita si no aporta.
3. **Consolidar los dos grises.** Reemplazar cualquier uso literal de `#141D2E` por el token `text-foreground` que ya resuelve a `#121B2B`. Es una búsqueda-reemplazo en los archivos del detalle.
4. **Ajustar el bloque Totales.**
  - Subtotal, IVA y Total con el mismo tamaño de valor (`value-mx`, 16 / 600).
  - Total se distingue solo por color (azul primario) y por un borde/anillo sutil, no por tamaño. Deja de competir con el header.
5. **Reducir el "USD 6,320.00" duplicado.**
  - Si se mantiene en el header, la tarjeta Totales usa `value-mx`.
  - Alternativa (recomendada): quitar el número del header y dejar solo `F975 · Sustituida · INDIMEX TRADING · Exp. ELIMP00294`. El total vive en su carta. Confirmar preferencia (ver pregunta abajo).
6. **UUID / RFC / Folio → estilo `mono` (13 / 500).** Un pelo más chico que el resto de valores para que el bloque monoespaciado no pese de más.
7. **Densidad del Timbrado fiscal.** Fecha de emisión queda huérfana en su propia fila. Reordenar el grid a `UUID · Serie · Folio · Fecha` en una sola fila (4 columnas en FullHD) para eliminar la fila casi vacía.

## Archivos afectados (sección técnica)

- `src/features/facturacion/components/detalle/TabResumen.tsx` — títulos de tarjeta, etiquetas Receptor, grid de Timbrado fiscal.
- `src/features/facturacion/components/detalle/FacturaDetalleView.tsx` — títulos de las tarjetas inferiores + header con total.
- `src/features/facturacion/components/detalle/*` (Totales, HistorialPagos, NotasCredito, HistorialFactura) — normalizar CardHeader.
- Posible pequeño componente compartido `FacturaCardHeader` (title + icon) para prevenir que vuelva a divergir.
- Cero cambios en `index.css` / `tailwind.config.ts` (uso los tokens existentes).

## Fuera de alcance

- Colores nuevos, iconos nuevos, animaciones. Solo tipografía y espaciado.
- Cambios en tabs distintos a "Resumen".
- Cambios en la lógica de negocio o en los datos mostrados.

## Pregunta antes de implementar

En el header, el "USD 6,320.00" se ve idéntico al de la tarjeta Totales. ¿Prefieres…

- **A. Quitarlo del header** y dejarlo solo en la tarjeta Totales (mi recomendación). Esto
- **B. Mantenerlo en el header** y en Totales dejar los tres KPIs al mismo tamaño (Total solo se distingue por color).