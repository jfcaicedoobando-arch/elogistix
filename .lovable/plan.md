# Arreglar el encabezado truncado del detalle de factura

## Qué se ve mal hoy (verificado en la app, no supuesto)

Al abrir F1052 en pantalla ancha (capturas a 1600 px y en tu screenshot):

- La fila de estados (Borrador → Por timbrar → Emitida → Pagada) queda comprimida: "Por timbrar" se parte en dos líneas y la última píldora ("Emitida"/"Pagada") se corta a media palabra.
- La línea de contexto (cliente • fecha • expediente • proforma) se parte en 3–4 renglones y se recorta.
- Todo esto pasa porque en pantallas ≥1280 px el encabezado se divide en dos columnas: la izquierda (título + contexto + stepper) y la derecha con 5 botones de acción que no se encogen. La columna izquierda se queda con poco ancho y el stepper, que vive dentro de ella con recorte horizontal, se corta.

Analogía: hoy el semáforo de estados va sentado en el asiento angosto junto a la fila de botones; se le pisan los codos. Hay que darle su propio renglón.

## Qué se va a cambiar (sólo presentación)

1. **El stepper de estados pasa a su propio renglón**, a todo el ancho del encabezado, debajo del título y de la barra de acciones. Así ya no compite por espacio y nunca se corta.
2. **La columna del título deja de ahogarse**: la barra de acciones podrá encogerse/envolver y el título/contexto conservan un ancho mínimo usable.
3. **La línea de contexto** (cliente • fecha • Exp. • Proforma) deja de recortarse: se permite envolver en dos renglones legibles sin cortar texto.
4. **Píldoras del stepper**: etiquetas en una sola línea (sin partir "Por timbrar") y separadores más cortos, con desplazamiento horizontal suave sólo si de plano no caben (pantallas muy chicas).

## Alcance

- Se toca el encabezado compartido de páginas de detalle y el stepper compartido, por lo que el mismo arreglo mejora igual a **factura, proforma y factura de proveedor** (las tres usan el mismo encabezado). Es consistencia, no una función nueva.
- Sin cambios de datos, cálculos, permisos, RLS, servicios ni base de datos. Sin nuevas dependencias.

## Detalles técnicos

- `src/components/shared/DetailHeader.tsx`: mover el slot `meta` fuera de la columna del título a un renglón propio full-width bajo la fila `title/trailing`; permitir `min-w-0` + `flex-wrap` real en `trailing` para que no reserve ~640 px fijos; ajustar el `line-clamp` del subtítulo a envoltura de dos renglones sin corte.
- `src/components/shared/documento/DocumentoStatusStepper.tsx`: `whitespace-nowrap` + `shrink-0` en las píldoras, separadores más angostos, conservar `overflow-x-auto` con degradado sólo cuando desborde.
- Verificación focalizada: capturas Playwright del detalle de factura a 1102, 1366 y 1600 px, más pruebas focalizadas existentes de `DetailHeader`/detalle de factura si aplican.
- Registro: bullet en `[Unreleased]` de `CHANGELOG.md`. Sin cambiar `APP_VERSION` (queda 13.823.69) ni el manifest.
- CI, RLS y suites globales quedan para GitHub Actions.
