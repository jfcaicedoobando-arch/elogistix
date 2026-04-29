## Problema

Al hacer click en "Marcar revisado" en la tabla de Auditoría no ocurre nada visible: ni se abre el diálogo, ni aparece toast, ni se actualiza la lista.

## Diagnóstico

El flujo es: botón → `setDialogHallazgo(h)` → abre `MarcarRevisadoDialog` → usuario escribe acción → `useMarcarRevisado.mutateAsync` hace `upsert` a `auditoria_revisiones` con `onConflict: "organization_id,embarque_id,regla,detalle_hash"`.

Hipótesis principal (más probable): el `upsert` falla silenciosamente por una de estas tres razones:

1. **Falta la UNIQUE constraint** sobre `(organization_id, embarque_id, regla, detalle_hash)`. Sin ella, Postgres rechaza el `ON CONFLICT` con error *"no unique or exclusion constraint matching"*. El error se muestra como toast pero puede pasar desapercibido si el usuario está viendo la tabla.
2. **El rol efectivo del usuario es `viewer`** (no admin/operador). La policy `Tenant CRUD auditoria_revisiones` exige admin/operador/super_admin para INSERT, así que el upsert es rechazado por RLS.
3. **El diálogo no abre** porque algún elemento padre intercepta el click (no parece ser el caso aquí; los botones de la tabla no tienen `stopPropagation` pero tampoco hay `onClick` en el `TableRow`).

## Pasos de implementación

1. **Verificar la base de datos** con `supabase--read_query`:
   - Listar constraints (`pg_indexes` / `pg_constraint`) de `auditoria_revisiones` para confirmar si existe el índice único.
   - Revisar el rol efectivo del usuario actual en `organization_members`.

2. **Corregir el upsert según el hallazgo**:
   - Si falta la UNIQUE constraint, crear migración:
     ```sql
     ALTER TABLE public.auditoria_revisiones
       ADD CONSTRAINT auditoria_revisiones_unique_finding
       UNIQUE (organization_id, embarque_id, regla, detalle_hash);
     ```
   - Si el problema es RLS (viewer sin permisos), añadir manejo claro: deshabilitar el botón "Marcar revisado" cuando `usePermissions().canEdit === false` y mostrar tooltip "Sin permisos para revisar".

3. **Mejorar visibilidad de errores en `useMarcarRevisado`**:
   - Loguear `console.error(error)` además del toast para que cualquier fallo silencioso quede en consola.
   - Asegurar que el toast de error use `description: err.message` (ya lo hace, pero confirmar que el error de Postgres llegue completo).

4. **Hacer el diálogo más robusto**:
   - Agregar `aria-describedby` o `DialogDescription` explícita para silenciar los warnings de Radix (ya hay `DialogDescription` pero los warnings sugieren que en algún caso no se renderiza — revisar).
   - Verificar que `setDialogHallazgo(h)` realmente dispare un re-render (añadir log temporal si es necesario).

5. **Actualizar versión y changelog** (`v8.99.53`):
   - `src/constants/appVersion.ts`
   - `src/content/changelog/v8/chunks/0.ts`
   - `src/content/changelogData.ts`
   - Entrada: "Fix: el botón 'Marcar como revisado' en Auditoría ahora funciona correctamente. Se agregó constraint única y manejo de permisos."

## Archivos a modificar

- `supabase/migrations/<timestamp>_auditoria_revisiones_unique.sql` (nueva, si falta la constraint)
- `src/hooks/auditoria/useAuditoriaRevisiones.ts` (mejor logging de errores)
- `src/components/auditoria/HallazgosTablaPaginada.tsx` (deshabilitar botón si no hay permisos)
- `src/components/auditoria/MarcarRevisadoDialog.tsx` (asegurar accesibilidad del Dialog)
- `src/constants/appVersion.ts`
- `src/content/changelog/v8/chunks/0.ts`
- `src/content/changelogData.ts`

## Resultado esperado

Al hacer click en "Marcar revisado":
1. El diálogo abre inmediatamente.
2. Al guardar, el toast confirma "Hallazgo marcado como revisado".
3. El hallazgo desaparece de la tabla (al estar oculto por defecto los revisados).
4. Si el usuario no tiene permisos, el botón aparece deshabilitado con tooltip explicativo.
