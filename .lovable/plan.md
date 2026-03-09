

## Corregir eliminación de documentos en embarques (v4.32.2)

### Problema 1 — TabDocumentos sin confirmación

En `src/components/embarque/TabDocumentos.tsx`, el botón Eliminar llama `onDelete(doc)` directamente. Se agregará un `AlertDialog` con estado local para controlar qué documento se va a eliminar.

- Agregar estado `docToDelete` para trackear el documento seleccionado
- El botón Eliminar abre el diálogo seteando `docToDelete`
- Al confirmar, llama `onDelete(docToDelete)` y cierra
- Título: "¿Eliminar documento?"
- Descripción: "El archivo {nombre} será eliminado permanentemente. Esta acción no se puede deshacer."

### Problema 2 — handleDeleteDoc hace UPDATE en vez de DELETE

En `src/pages/EmbarqueDetalle.tsx` línea 101, cambia el `update` por `delete`:

```typescript
// Antes:
await supabase.from("documentos_embarque").update({ archivo: null, estado: "Pendiente" as any }).eq("id", doc.id);

// Después:
await supabase.from("documentos_embarque").delete().eq("id", doc.id);
```

### Archivos a modificar (3)

1. `src/components/embarque/TabDocumentos.tsx` — AlertDialog de confirmación
2. `src/pages/EmbarqueDetalle.tsx` — DELETE en vez de UPDATE
3. `src/pages/Changelog.tsx` — entrada v4.32.2

