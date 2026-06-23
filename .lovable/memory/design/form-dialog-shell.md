---
name: FormDialogShell
description: Shell unificado para todo modal tipo formulario (Cliente, Proveedor, Factura, etc.) — usarlo en vez de construir Dialog+Header+Footer a mano
type: preference
---

Para todo modal nuevo o refactor de un modal tipo formulario (crear/editar entidad, captura de datos, wizards 2-3 pasos), usar `FormDialogShell` desde `@/components/shared/FormDialogShell` en lugar de armar manualmente `Dialog + DialogContent + DialogHeader + DialogFooter`.

**Por qué**: garantiza icon-tile header consistente, descripción accesible, slot derecho para resumen vivo (totales/badges), stepper visual segmentado en wizards, cuerpo scrolleable y footer sticky con separador — todo el back-office habla el mismo lenguaje visual.

**Cómo aplicarlo**:
- `FormDialogShell` acepta `icon` (LucideIcon), `title`/`description` (ReactNode), `size` (`md`|`lg`|`xl`|`2xl`), `headerAside` (slot derecho), `step`/`totalSteps`/`stepLabels` (wizards), `footer` (acciones) y `children` (cuerpo).
- Para agrupar campos: envolver bloques en `FormDialogSection` (sub-encabezado opcional + grid responsive 1↔2 cols, o `flat` para contenido no-grid).
- Para steppers: usar `FormDialogStepper` (ya integrado al shell) — NO escribir "Paso X de Y" en el título.
- Tamaños sugeridos: `md` para 1-2 campos, `lg` para forms cortos (cliente), `xl` para forms medianos o con totales (proveedor, factura).

**Cuándo NO usarlo**: alerts/confirmaciones (`DoubleConfirmDeleteDialog`, `AlertDialog`, "Marcar como facturada"), popovers, error dialogs cortos. Esos quedan como están — el shell se siente pesado para una sola pregunta sí/no.

**Migraciones ya hechas (referencia)**: `NuevoClienteDialog`, `DialogEditarCliente`, `NuevoProveedorDialog`, `EditarProveedorDialog`, `DialogNuevaFacturaProveedor`, `DialogEditarFacturaProveedor`.
