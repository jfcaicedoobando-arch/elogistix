## Objetivo

Agregar el botón/zona para subir la Constancia de Situación Fiscal (CSF en PDF) dentro del diálogo **Editar Cliente**, para que al actualizar el expediente se puedan volver a extraer y sobreescribir los datos fiscales automáticamente (igual que en el alta).

## Contexto

Hoy la subida de CSF sólo existe en el wizard de "Nuevo Cliente" (`NuevoClienteFormPieces.tsx` + `useNuevoClienteController.ts`). El diálogo `DialogEditarCliente.tsx` sólo tiene campos manuales, por eso el usuario no ve la opción al editar.

El servicio `parseCsf` (`src/features/cliente/services/csf/index.ts`) ya es reutilizable: recibe un `File` y devuelve `{ nombre, rfc, cp, direccion, ciudad, estado, regimen_fiscal }`.

## Cambios propuestos (solo UI + reuso de servicio)

1. **`src/features/cliente/components/DialogEditarCliente.tsx`**
   - Añadir un `FormDialogSection` nuevo al inicio, arriba de "Datos fiscales", titulado "Actualizar desde CSF (opcional)".
   - Dentro incluir una drop-zone compacta (mismo componente visual que en alta) con:
     - Input file oculto (`accept="application/pdf"`) + botón "Subir CSF".
     - Estado local `isParsing` con `Loader2` mientras se procesa.
     - Al recibir un PDF: llamar `parseCsf(file)` y, con el resultado, hacer merge sobre `form` respetando lo ya capturado sólo si el campo viene vacío del PDF (`patch.rfc ?? prev.rfc`, etc.), igual que `mergeCsfPatch` de proveedor.
     - Toast de éxito ("CSF procesada. Verifica los datos actualizados.") y de error usando `notifyError`.
   - Nota informativa: "Los campos se rellenarán con los datos extraídos; podrás ajustarlos antes de guardar."
   - No auto-guarda: el usuario sigue viendo los cambios y presiona "Guardar cambios".

2. **Reutilización**
   - Extraer la drop-zone actual de `NuevoClienteFormPieces.tsx` a un componente compartido `CsfDropzone` en `src/features/cliente/components/CsfDropzone.tsx` (props: `onFile(file)`, `isParsing`, `variant?: "compact"`), y consumirlo tanto en Nuevo Cliente como en Editar Cliente para evitar duplicar UI.
   - `NuevoClienteFormPieces.tsx` pasa a importar `CsfDropzone` sin cambio de comportamiento.

3. **Housekeeping**
   - Bump `APP_VERSION` en `src/constants/appVersion.ts` a `13.163.2`.
   - Entrada en `CHANGELOG.md` bajo `[13.163.2]`: "Editar Cliente ahora permite subir CSF para actualizar datos fiscales."

## Fuera de alcance

- No se toca el servicio `parseCsf` ni ninguna RPC.
- No se agrega persistencia del PDF (igual que hoy en alta, sólo se extraen datos).
- No se cambia la validación ni el guardado del cliente.

## Detalles técnicos

- `parseCsf` requiere sesión Supabase (ya la tiene el usuario autenticado que edita).
- El merge se aplica sobre `form` via `setForm(prev => ({...prev, ...patch}))` con fallback al valor previo cuando el campo del CSF venga vacío.
- Manejo de errores: `try/catch` con `notifyError(toast, { title, error, method: "DIALOG_EDITAR_CLIENTE_CSF" })`.
