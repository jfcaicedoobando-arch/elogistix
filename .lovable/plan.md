## Objetivo

Permitir, en la tabla de hallazgos de Auditoría, seleccionar varias filas pendientes de la página actual y marcarlas como revisadas en una sola operación, capturando una nota/acción común que se aplica a todas.

## UX

1. **Checkbox por fila** (sólo en hallazgos pendientes — los ya revisados no son seleccionables).
2. **Checkbox maestro** en el header: selecciona/deselecciona todos los pendientes visibles en la página actual. Estado indeterminado si hay selección parcial.
3. **Barra de acciones flotante** sobre la tabla cuando `selección > 0`:
   - Texto: "N hallazgos seleccionados"
   - Botón primario: "Marcar como revisados"
   - Botón secundario: "Limpiar selección"
4. **Diálogo `MarcarRevisadosBulkDialog`** al confirmar:
   - Resumen: "Vas a marcar N hallazgos como revisados".
   - Lista compacta (scroll, máx ~10 visibles) con expediente + regla + detalle truncado.
   - Textarea **obligatoria** "Acción tomada" (placeholder: "Ej. Validado por contabilidad el 27/06/2026").
   - Botones: Cancelar / Confirmar.
5. Al confirmar: progress + toast de resultado (`X revisados, Y con error` si hay fallos parciales).
6. La selección se limpia al cambiar de página, cambiar filtros o cerrar el diálogo con éxito.

## Cambios de código (frontend-only, sin SQL nuevo)

| Archivo | Cambio |
|---|---|
| `src/features/auditoria/hooks/useHallazgosTablaState.ts` | Agregar `selectedIds: Set<string>`, `toggleSelected`, `toggleAllVisible`, `clearSelection`, `selectablesEnPagina` (pendientes visibles). Reset al cambiar página/filtros. |
| `src/features/auditoria/components/HallazgosTabla.tsx` | Columna checkbox al inicio (sólo si fila es pendiente). Header con checkbox maestro tri-estado. Props nuevas: `selectedIds`, `onToggle`, `onToggleAll`, `selectablesIds`. |
| `src/features/auditoria/components/HallazgosBulkBar.tsx` *(nuevo)* | Barra de acciones cuando hay selección. |
| `src/features/auditoria/components/MarcarRevisadosBulkDialog.tsx` *(nuevo)* | Modal de confirmación con textarea + lista. Usa `FormDialogShell`. |
| `src/features/auditoria/hooks/useMarcarRevisadosBulk.ts` *(nuevo)* | Hook que itera sobre selección, llama `upsertAuditoriaRevision` para cada uno, agrega resultados éxito/fallo, invalida queries de revisiones, lanza toasts. Concurrencia limitada (`Promise.allSettled` por chunks de 5). |
| `src/features/auditoria/components/HallazgosTablaPaginada.tsx` | Ensamblar `HallazgosBulkBar` + `MarcarRevisadosBulkDialog`; pasar handlers. |

Sin cambios de SQL/RPC: reutilizamos `upsertAuditoriaRevision` (ya idempotente vía `onConflict`). El `accion_tomada` es la nota común tecleada por el usuario.

## Tests

- `useHallazgosTablaState.test.ts`: toggles, "select all visible page", limpieza al cambiar página/filtros, no-selecciona ya revisados.
- `useMarcarRevisadosBulk.test.tsx`: éxito total, fallo parcial (resumen "X/Y"), invalidación de query, validación nota vacía.
- `MarcarRevisadosBulkDialog.test.tsx`: render, deshabilita confirmar con nota vacía.

## Versionado

Bump `APP_VERSION` patch (`13.139.x`) + entrada nueva en `CHANGELOG.md`.

## Fuera de alcance

- Bulk para snooze, asignar responsable o deshacer revisión (sólo "marcar revisado").
- Selección cross-page (queda como mejora futura).
