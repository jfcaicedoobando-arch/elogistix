## Contexto
Tras inspeccionar la base de código se encontró que `src/pdf/render/descargarPdf.ts` ya implementa el patrón defensivo (`try/finally` + `setTimeout(..., 4000)` para `URL.revokeObjectURL`). Sin embargo, existen 5 sitios adicionales que crean un blob URL para descarga directa y revocan la URL de forma inmediata o sin bloque `finally`, lo que puede provocar fugas de memoria si el navegador no alcanza a iniciar la descarga antes de la revocación.

## Alcance
1. Extraer una función helper reutilizable `descargarBlob` con el patrón defensivo existente.
2. Refactorizar los 5 sitios identificados para usar esta helper en lugar de duplicar la lógica de anclaje + revocación.
3. Agregar tests unitarios para la nueva helper.
4. Actualizar `CHANGELOG.md` y `APP_VERSION`.

## Archivos a modificar

### Nueva helper
- `src/lib/downloadBlob.ts` — Función helper que encapsula: creación del `<a>`, `.click()`, remoción del nodo y `URL.revokeObjectURL(url)` dentro de un `finally` con `setTimeout` de 4 s.

### Refactors
- `src/hooks/portal/usePortalDocumentDownload.ts` — Usa `descargarBlob(blob, filename)` en lugar del flujo manual actual.
- `src/lib/csv/downloadCsvTemplate.ts` — Usa `descargarBlob(blob, fileName)` en lugar del flujo manual.
- `src/generators/exportCsv.ts` — Usa `descargarBlob(blob, filename)`.
- `src/pages/profit/ProfitDashboardEjecutivo.tsx` — Usa `descargarBlob(blob, nombreArchivo)`.
- `src/features/embarques/hooks/useEmbarqueDocumentosActions.ts` — Usa `descargarBlob(blob, fileName)`.

### Tests
- `src/lib/__tests__/downloadBlob.test.ts` — Verifica que se crea el `<a>`, se invoca `.click()`, se programa la revocación con delay y se ejecuta `URL.revokeObjectURL`.

### Versionado
- `src/constants/appVersion.ts` — Bump a `12.61.8`.
- `CHANGELOG.md` — Entrada `[12.61.8]` con descripción del cambio.

## Detalle técnico

```text
Patrón actual en descargarPdf.ts (ya correcto):
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

Patrón incorrecto en los 5 sitios (ejemplo):
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);   // revocación inmediata, sin finally
```

La helper `descargarBlob(blob: Blob, nombreArchivo: string)` unificará el patrón correcto y eliminará la duplicación.
