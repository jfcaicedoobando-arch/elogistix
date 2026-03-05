

## Plan: Agregar botón "Eliminar" en documentos de embarque

### Cambios en 3 archivos

**1. `src/components/embarque/TabDocumentos.tsx`**
- Agregar prop `onDelete` y `deletingDocId` a la interfaz
- Importar `Trash2` de lucide-react
- Cuando `doc.archivo` existe y `canEdit`, mostrar botón rojo "Eliminar" junto a Descargar
- Spinner mientras se elimina

**2. `src/pages/EmbarqueDetalle.tsx`**
- Agregar estado `deletingDocId`
- Crear `handleDeleteDoc`: elimina archivo de Storage con `deleteFile(doc.archivo)`, luego actualiza el registro en `documentos_embarque` poniendo `archivo = null, estado = 'Pendiente'`, registra en bitácora, refetch docs
- Pasar `onDelete` y `deletingDocId` a `TabDocumentos`

**3. `src/pages/Changelog.tsx`** — entrada v4.10.2

### Lógica de eliminación
No se borra el registro de `documentos_embarque`, solo se limpia el campo `archivo` y se regresa el estado a "Pendiente", permitiendo subir otro archivo.

