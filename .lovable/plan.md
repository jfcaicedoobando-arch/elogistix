

## Plan: Hacer funcional la carga de documentos en el paso 3 de Nuevo Embarque

### Problema
`StepDocumentos` renderiza un botón "Subir" por cada documento requerido, pero ese botón no tiene ningún handler ni input de archivo asociado. Es solo UI estática.

### Solución
Reemplazar la UI estática con el componente reutilizable `DocumentChecklist` que ya existe en el proyecto y conectar la lógica de selección de archivos. Los archivos seleccionados se almacenarán en estado local del formulario y se subirán a Supabase Storage al momento de crear el embarque (en `handleFinish`).

### Cambios

**1. `src/components/embarque/StepDocumentos.tsx`**
- Reescribir para usar `DocumentChecklist` (ya maneja refs de file inputs, indicadores visuales, botón adjuntar/cambiar)
- Props: recibir `documentos: DocumentoChecklist[]` y `onFileChange: (nombre, file) => void` en lugar de solo `modo`
- Eliminar la lógica interna de `getDocsForMode` (se mueve al padre)

**2. `src/hooks/useEmbarqueForm.ts`**
- Agregar estado `documentosArchivos: Record<string, File>` para almacenar los archivos seleccionados por nombre de documento
- Exponer `documentosArchivos`, `setDocumentoArchivo(nombre, file)` y `getDocumentosChecklist(modo)` que combina la lista de docs requeridos con el estado de adjuntos

**3. `src/pages/NuevoEmbarque.tsx`**
- Pasar las nuevas props a `StepDocumentos`
- En `handleFinish`, subir cada archivo de `documentosArchivos` a Storage antes de crear el embarque, y pasar la ruta del archivo al payload de documentos

**4. `src/pages/Changelog.tsx`**
- Nueva entrada v4.3.3

### Sin cambios en BD
La tabla `documentos_embarque` ya tiene columna `archivo: text` para almacenar la ruta. Solo falta llenarla.

