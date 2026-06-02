## Objetivo

Permitir marcar documentos como **"No aplica"** desde el tab Documentos del embarque, para que queden excluidos de los conteos de "documentos faltantes" (dashboard del operador, sidebar y auditoría). El **BL Master** queda excluido de esta opción: siempre es obligatorio.

## Cambios

### 1. Base de datos (migración)
- Agregar el valor `'No aplica'` al enum `estado_documento` (ya tiene `Pendiente`, `Recibido`, `Validado`).

### 2. Servicio
`src/services/embarque/documentos.ts`
- Nueva función `marcarDocumentoNoAplica(docId)` → `UPDATE estado = 'No aplica', archivo = null`.
- Nueva función `marcarDocumentoPendiente(docId)` → revierte a `'Pendiente'` (para deshacer).

### 3. Hook de acciones
`src/hooks/embarque/useEmbarqueDocumentosActions.ts`
- Agregar `handleToggleNoAplica(doc)`: si `estado === 'No aplica'` → vuelve a `Pendiente`; si no, marca `No aplica`. Registra en bitácora (`marcar_documento_no_aplica` / `revertir_documento_no_aplica`) y dispara invalidación de la query de documentos.

### 4. UI — columnas del tab
`src/components/embarque/tabDocumentos/useDocumentoColumns.tsx`
- Nueva acción **"No aplica"** (icono `Ban` / `MinusCircle`) visible cuando:
  - `canEdit === true`
  - `doc.archivo` está vacío (no se permite marcar No aplica si ya hay archivo subido)
  - `doc.nombre !== 'BL Master'` (siempre obligatorio)
- Si `doc.estado === 'No aplica'` el botón cambia a **"Marcar pendiente"** para deshacer.
- Cuando un documento está en `No aplica`: ocultar el botón "Subir" para evitar confusión (se reactiva al deshacer).

### 5. UI — visual del estado
`src/lib/ui/uiMappings.ts` → `getDocEstadoColorClass`: agregar caso `"No aplica"` → `bg-muted-foreground/40` (gris neutro). El badge del estado mostrará "No aplica" igual que los demás (texto del enum).

### 6. Conteos / dashboards (sin cambios funcionales, sólo verificación)
- `useDashboardOperador.ts` ya filtra `.eq("estado", "Pendiente")` → automáticamente excluye "No aplica". ✓
- Auditoría `docs_faltantes` ya busca sólo `Pendiente`. ✓
- Sidebar / badges de "Docs incompletos" usan el mismo criterio. ✓

### 7. Mantenimiento
- Bump `APP_VERSION` a **12.50.3**.
- Entrada en `CHANGELOG.md` describiendo la nueva acción y la regla de BL Master.

## Notas técnicas
- `BL Master` se identifica por el nombre exacto (es el documento sembrado por defecto en `useCreateEmbarque`). No se introduce un campo `obligatorio` en BD para mantener el cambio mínimo; si más adelante se requiere marcar otros como obligatorios, se puede migrar a un flag booleano.
- El UPDATE pasa por las políticas RLS existentes (`Tenant CRUD documentos_embarque`), no se requieren cambios de seguridad.
- Las funciones de servicio reutilizan el patrón `.select('id')` para detectar 0 filas afectadas y lanzar error explícito.
