# Confirmación de filtros — Cotizaciones y CxP

Los campos dentro de Filtros editan un borrador que se toma de los filtros
aplicados al abrir. Sólo Aplicar confirma los campos modificados y cierra.
Cancelar, X y Escape descartan la edición; reabrir toma los valores aplicados.
Limpiar dentro del panel modifica el borrador, sin llamar a los setters del listado.

Búsqueda, chips, Limpiar todo y los controles visibles fuera del panel conservan
su aplicación inmediata. En móvil, los primarios que pasan al panel también
usan el borrador. No cambian los valores por defecto de cada pantalla.

## Demo interna sencilla

En una sesión interna con datos de prueba, repetir en Cotizaciones,
CxP Por pagar y el listado de facturas CxP:

1. Partir de un listado con filtros y, cuando haya suficientes filas, otra página.
2. Abrir Filtros y cambiar un campo. El listado, URL y página siguen iguales.
3. Pulsar Cancelar y reabrir: aparece el valor aplicado. Repetir con X y Escape.
4. Pulsar Limpiar y luego Cancelar: se conservan los filtros aplicados.
5. Cambiar un campo y pulsar Aplicar: se confirma el filtro y se cierra el panel.
6. Reabrir para comprobar la selección. Limpiar + Aplicar confirma los defaults.
7. Fuera del panel, comprobar búsqueda, quitar chips y Limpiar todo.
   En escritorio, comprobar también los selects primarios y Origen de CxP.

Revisar a 1280×720 y 691×763, claro/oscuro y con teclado.

## Regresión automatizada

Las pruebas de componentes cubren ambas ubicaciones de los primarios,
los tres cierres, Limpiar + Cancelar, Limpiar + Aplicar, reapertura,
confirmación única por campo modificado y controles externos vivos.
Cotizaciones y Por pagar usan el estado real de filtros y el adaptador de nuqs
para comprobar que la edición no cambia consulta, URL ni página.

```bash
bun run test -- src/features/cotizacion/components/__tests__/CotizacionesFiltersBar.draft.test.tsx src/features/bandejas/components/__tests__/CxpPorPagarFiltersBar.draft.test.tsx src/features/cxp/components/__tests__/CxpFiltros.draft.test.tsx
bun run typecheck
```
