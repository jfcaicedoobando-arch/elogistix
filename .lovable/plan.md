Diagnóstico: el botón sí abre el diálogo y envía la solicitud, pero el backend la rechaza con `new row violates row-level security policy for table "auditoria_revisiones"`.

La causa es un desalineamiento entre permisos de la app y permisos de base de datos:

- La app ve al usuario como `orgRole: admin`, por eso muestra el botón como si pudiera editar.
- La política RLS actual de `auditoria_revisiones` valida con `has_role(...)`, que revisa el rol global en `user_roles`.
- En esta sesión el rol global es `viewer`, aunque el rol dentro de la organización es `admin`.
- Resultado: la UI permite intentar marcar revisado, pero RLS bloquea el insert/upsert.

Plan de corrección:

1. Actualizar permisos RLS de `auditoria_revisiones`
   - Agregar una función segura para validar rol por organización, por ejemplo `has_org_role(user_id, organization_id, role)`.
   - Reemplazar la política CRUD de `auditoria_revisiones` para permitir:
     - `admin` u `operador` dentro de la misma organización.
     - `super_admin` global.
   - Mantener lectura para miembros de la organización según el modelo multi-tenant actual.
   - Esto hará que el `orgRole: admin` que ya muestra la app coincida con lo que permite la base de datos.

2. Hacer el flujo más claro en la UI
   - Si vuelve a fallar una operación, mostrar un mensaje más específico en el toast en español mexicano, indicando que puede ser un tema de permisos.
   - Evitar que parezca que “no pasó nada” cuando el backend rechaza la acción.

3. Corregir warning del diálogo
   - Ajustar `DialogFooter` para aceptar `ref` correctamente o reemplazarlo por un `div` local en `MarcarRevisadoDialog`.
   - Esto eliminará el warning de React: `Function components cannot be given refs`.

4. Mantener consistencia del módulo
   - Confirmar que al guardar exitosamente:
     - El hallazgo se oculta de la vista de pendientes.
     - Los KPIs dejan de contarlo.
     - El badge/sidebar se actualiza.
     - La revisión queda visible al activar “Ver revisados”.

5. Actualizar versión y changelog
   - Subir la versión a `8.99.54`.
   - Agregar entrada nueva al inicio de `recentChangelog` y del chunk v8 correspondiente, describiendo que ahora el botón respeta permisos por organización (`orgRole`) y ya no falla por RLS.

Archivos previstos:

- Nueva migración en `supabase/migrations/` para la función/políticas RLS.
- `src/hooks/auditoria/useAuditoriaRevisiones.ts` para mejorar mensajes de error.
- `src/components/auditoria/MarcarRevisadoDialog.tsx` o `src/components/ui/dialog.tsx` para resolver el warning del footer.
- `src/constants/appVersion.ts`.
- `src/content/changelogData.ts`.
- `src/content/changelog/v8/chunks/0.ts`.