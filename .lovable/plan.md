# Arreglar el modal de pago a proveedor recortado

## Qué está pasando

El modal de "Registrar pago a proveedor" se abre en tamaño `lg` (unos 512 px de ancho), pero su encabezado dibuja 4 tarjetas de KPI (Total, Pagado, Saldo pendiente, Moneda) en una sola fila cuando la ventana del navegador es ancha. Con importes largos como `USD 6,348.00` cada tarjeta queda demasiado angosta: los montos se cortan y "MONEDA · TC 17.55" se parte en tres renglones. Eso empuja el resto del formulario hacia abajo y, en pantallas de poca altura (la actual es de 675 px), el área con scroll queda muy chica, dando la sensación de modal recortado.

## Qué se va a cambiar (solo presentación)

1. **Ancho del modal**: subir "Registrar pago a proveedor" y "Editar pago a proveedor" de `lg` a `2xl`, para que los importes quepan sin cortarse.
2. **Rejilla de KPIs del encabezado**: dejar 2 columnas en pantallas chicas y pasar a 4 solo cuando hay ancho real disponible; los montos se ajustan con tamaño de texto un poco menor y sin recorte (con tooltip/título si el valor es muy largo).
3. **Encabezado compacto en pantallas bajas**: en alturas ≤800 px reducir el padding de las tarjetas y el espaciado del bloque de folio/estado, para que el cuerpo del formulario tenga más alto útil y menos scroll.
4. **Chip de moneda/TC**: mostrar "USD" y "TC 17.55" como dos líneas controladas en lugar de un texto que se rompe solo.

No se toca ninguna validación, cálculo, tipo de cambio ni lógica de guardado.

## Detalle técnico

- `src/features/cxp/components/DialogRegistrarPagoProveedor.tsx` y `DialogEditarPagoProveedor.tsx`: `size="lg"` → `size="2xl"`.
- `src/features/cxp/components/PagoProveedorBits.tsx` (`PagoFacturaHeaderInfo`): la rejilla pasa de `grid-cols-2 md:grid-cols-4` a `grid-cols-2 sm:grid-cols-4`; se compacta el espaciado (`space-y-3` → `space-y-2.5 short:space-y-2`) y el valor de Moneda se arma con dos líneas (`USD` + `TC 17.55`).
- `src/features/cxp/components/DialogDetallePagosProveedor.parts.tsx` (`Kpi`): variante compacta — `p-4` → `p-3 short:p-2.5`, valor `text-lg` → `text-base`, `whitespace-nowrap` + `title` para valores largos. Se revisa que los demás consumidores de `Kpi` sigan viéndose bien.
- Verificación con Playwright a 1028x675 y a 1366x768: abrir el modal en el detalle de la factura de proveedor, capturar el encabezado y confirmar que los 4 importes se leen completos y que el formulario (fecha, método, cuenta, monto) es alcanzable sin recorte.
- `CHANGELOG.md` + `APP_VERSION` con el ajuste visual.
