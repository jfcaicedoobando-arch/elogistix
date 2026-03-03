

## Plan: Cambiar "RFC" por "Tax ID" en contactos de cliente

### Problema
En el diálogo de crear/editar contactos (Proveedor, Exportador, Importador) dentro de un cliente, el campo dice "RFC", pero estos contactos pueden ser de otros países.

### Solución
Cambiar la etiqueta del campo de "RFC" a "Tax ID" en la línea 284 de `src/pages/ClienteDetalle.tsx`. También actualizar la tabla de contactos (columna header) si muestra "RFC".

### Archivos a modificar

**`src/pages/ClienteDetalle.tsx`** (línea 284)
- Cambiar `<Label className="text-xs">RFC</Label>` por `<Label className="text-xs">Tax ID</Label>`
- Sin cambios en el campo de datos (`form.rfc` / columna `rfc` en BD) — solo la etiqueta visual

**`src/pages/Changelog.tsx`**
- Nueva entrada v4.2.5 documentando el cambio

