## Problema
Los modales de "Registrar pago" usan `<Input type="date">` nativo, que en navegadores con locale en inglés muestra `mm/dd/yyyy` en lugar del formato mexicano `dd/mm/yyyy`.

## Solución
Reemplazar `<Input type="date">` por el componente `DatePickerMx` (ya existente en `src/components/ui/date-picker-mx.tsx`), que muestra siempre `DD/MM/YYYY` y guarda el valor ISO internamente.

## Archivos a modificar
1. **`src/features/comisiones/components/DialogRegistrarPagoLiquidacion.tsx`** — campo "Fecha".
2. **`src/features/cxp/components/PagoProveedorFormBody.tsx`** — campo "Fecha de pago" (usado por `DialogRegistrarPagoProveedor`).

## Versionado
- Bump `APP_VERSION` a `13.135.56`.
- Añadir entrada en `CHANGELOG.md`.

## Analogía
Es como cambiar un reloj que muestra la hora en formato gringo (AM/PM) por uno de 24 horas estilo mexicano: el momento exacto es el mismo, sólo cambia cómo se ve.
