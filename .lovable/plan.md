# Estado de cuenta: descargar PDF en lugar de abrir diálogo de impresión

## Problema

Al dar clic en "Descargar PDF" del estado de cuenta de un cliente, se abre una pestaña nueva con el diálogo de **imprimir** del navegador. Esto pasa porque `src/generators/estadoCuentaPdf.ts` usa el patrón viejo (`window.open` + `win.print()`). Los demás documentos de la app (cotización, proforma, rentabilidad) ya descargan un archivo `.pdf` directamente con `@react-pdf/renderer` + `descargarPdf()`.

## Solución

Reescribir el generador del estado de cuenta con el mismo flujo moderno, conservando exactamente el mismo contenido del documento:

1. **`src/generators/estadoCuentaPdf.tsx`** (renombrado de `.ts` a `.tsx`):
   - Convertir el HTML actual a un `<Document>` de `@react-pdf/renderer` usando los estilos compartidos de `src/pdf/theme/` (misma tipografía y colores que cotización/proforma).
   - Contenido idéntico: encabezado del cliente (nombre, RFC, dirección), tabla de facturas con aging (Por vencer, 1-30, 31-60, 61-90, +90 días), totales por moneda y pie con el nombre de la empresa.
   - Descargar con `descargarPdf()` y nombre `{Org}_EstadoDeCuenta-{cliente}.pdf` usando `withOrgPrefix()` (regla global de nombres).
   - Sigue consultando los datos con los servicios existentes (`fetchEstadoCuentaFacturas`, `cargarEmisorEmpresa`) — no cambian consultas ni reglas de negocio.

2. **`src/features/facturacion/estadoCuenta/hooks/useExportActions.ts`**: sin cambios funcionales (ya llama a `generarEstadoCuentaPdf` y notifica éxito/error); sólo se ajusta el import si cambia la extensión.

3. **Prueba focalizada**: actualizar `src/generators/__tests__/estadoCuentaPdf.test.ts` para el nuevo flujo (mockear `descargarPdf` y verificar que el documento incluye facturas, aging y cliente; casos: lista vacía, bucket 31-60, datos del cliente).

## Qué NO cambia

- Contenido, columnas, buckets de antigüedad, totales ni consultas a la base de datos.
- El botón y el diálogo de envío por email.
- Sin migraciones, sin cambios de datos, sin dependencias nuevas (`@react-pdf/renderer` ya está en el proyecto).

## Validación

- Typecheck, ESLint focalizado, build y `audit:manifest`.
- Vitest focalizado del generador actualizado.
- Verificación visual convirtiendo el PDF generado a imagen (QA obligatoria de PDF).
- CI/RLS/E2E completas quedan para GitHub Actions.
- Bump a la siguiente versión patch + entrada en CHANGELOG + manifiesto.
