# Optimizar el modal "Capturar factura de proveedor" para HD

## Qué observé (captura real a 1366x768)

El modal se abre con ancho `xl` (~576 px) sobre una pantalla de 1366 px: usa el 42% del ancho disponible y deja el resto en gris. Todo el formulario cae en una sola columna dentro de un área scrolleable de ~540 px de alto, así que para capturar una factura hay que recorrer 5 bloques uno debajo del otro: totales (KPIs), carga del documento (Manual / XML CFDI / PDF por IA), conceptos, proveedor y folio + fechas + moneda + categoría + notas, vinculación de embarque y, al final, el semáforo de cuadre.

Consecuencias concretas:
- El semáforo de cuadre (la validación más importante antes de guardar) queda hasta abajo, fuera de vista mientras se capturan los conceptos.
- Los KPIs de totales se pierden al hacer scroll, justo cuando se necesitan para comparar contra el papel.
- El bloque de conceptos, que es una tabla, se comprime en 576 px.

## Qué voy a cambiar

1. **Ancho y alto útiles en HD**: el modal pasa a `4xl` (~896 px) y el cuerpo a `max-h-[92vh]`, manteniendo el comportamiento actual en móvil y tablet.

2. **Layout de dos columnas a partir de `lg`** (una sola columna abajo de ese ancho, sin cambios en móvil):
   - Columna izquierda (documento y partidas): banner del buzón, selector Manual / XML CFDI / PDF por IA, alerta de duplicado, conceptos del CFDI o conceptos manuales.
   - Columna derecha (datos de la factura): proveedor y folio, fechas y crédito, moneda e importes, categoría contable, notas y vinculación de embarque.

3. **Anclas fijas**: los KPIs de totales quedan fijos arriba del área scrolleable y el semáforo de cuadre justo encima del footer, de modo que subtotal, total y diferencia siempre estén visibles.

4. **Densidad**: reducir separadores redundantes entre secciones de la columna derecha y apoyarme en los encabezados de sección que ya existen, para ganar altura sin que se vea apretado.

No cambio ninguna regla de cálculo, validación, permisos ni guardado: es únicamente presentación.

## Detalles técnicos

- `src/components/shared/utils/dialogTokens.ts`: sin cambios; ya existe el token `4xl`.
- `src/components/shared/FormDialogShell.tsx`: agregar slots opcionales `stickyTop` y `stickyBottom` (render dentro del contenedor flex, fuera del área con `overflow-y-auto`) y permitir `bodyClassName`. Los diálogos existentes no se ven afectados porque los props son opcionales.
- `src/features/cxp/components/DialogNuevaFacturaProveedor.tsx`: `size="4xl"`, mover `FacturaProveedorTotalesKpis` a `stickyTop` y `CuadreConceptosBar` a `stickyBottom`, y repartir el resto en dos `div` con `grid grid-cols-1 lg:grid-cols-2 gap-6 items-start`. Si el archivo se acerca al límite de 200 líneas, extraigo las dos columnas a `DialogNuevaFacturaProveedor.columnas.tsx`.
- `src/features/cxp/components/FacturaProveedorFormFields.tsx`: quitar los `Separator` redundantes en el modo de dos columnas manteniendo los títulos de sección.
- Verificación con Playwright a 1366x768 y 1920x1080, más una revisión a 698x751 para confirmar que el apilado móvil sigue igual.
- `CHANGELOG.md` + `APP_VERSION` (13.400.0).
