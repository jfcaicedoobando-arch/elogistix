## Fix: Contador de documentos en portal del cliente

### Problema
El embarque ELIMP00172 muestra **0/7 documentos** en el portal aunque tiene 3 archivos descargables. El controller solo cuenta documentos en estado `"Validado"`, ignorando los `"Recibido"` (subidos pero aún no validados).

### Cambio (1 archivo, 1 línea)

**`src/hooks/embarque/usePortalEmbarqueDetalleController.ts`** — actualizar el filtro de `docsValidados` para incluir ambos estados completados, alineándolo con el comportamiento ya usado en `TabDocumentos.tsx` y `useEmbarquesListData`:

```ts
const docsValidados = useMemo(
  () => documentos.filter(
    (d) => d.estado === "Recibido" || d.estado === "Validado",
  ).length,
  [documentos],
);
```

### Resultado esperado
ELIMP00172 mostrará **3/7** en lugar de 0/7, reflejando los archivos realmente disponibles para el cliente.

### Changelog
Agregar entrada **v8.99.2** en `src/content/changelog/v8/chunks/0.ts`: "Corregido contador de documentos en portal del cliente que mostraba 0 aunque hubiera archivos recibidos."