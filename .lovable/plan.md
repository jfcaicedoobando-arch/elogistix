## Causa raíz del doble toast

Cuando eliminas un usuario en `/admin/usuarios`, se disparan **dos toasts idénticos** porque la notificación está duplicada en dos capas:

1. **El hook `useDeleteUser`** (`src/features/admin/hooks/usuario/useUsuarios.ts:39-50`) ya dispara `notifySuccess({ title: "Usuario eliminado" })` en su `onSuccess`, y `notifyError(...)` en su `onError`.
2. **La pantalla `Usuarios.tsx`** (`src/features/admin/routes/admin-org/Usuarios.tsx:55-63`) envuelve el `mutateAsync` en un `try/catch` y vuelve a llamar `notifySuccess({ title: "Usuario eliminado", description: ... })` / `notifyError(...)`.

Resultado: por cada eliminación se renderizan dos toasts (uno desde el hook, otro desde el componente). El mismo bug existe en el cambio de rol (`confirmRoleChange` en líneas 43‑53 + `useUpdateUserRole` en `useUsuarios.ts:24-37`).

**Analogía:** es como si pidieras una pizza y tanto el repartidor como la sucursal te llamaran por separado para avisarte que llegó. El mensaje es correcto, pero te suena el timbre dos veces.

## Plan de corrección

Dejar la notificación en **una sola capa**. La convención del proyecto (ver `useCreateUser`, `useUpdateUserRole`) es que **el hook de mutación es la fuente única de toasts**, porque así cualquier consumidor (otras pantallas, controladores, atajos) obtiene feedback sin tener que repetir el código.

### Cambios

**Archivo:** `src/features/admin/routes/admin-org/Usuarios.tsx`

1. En `handleDelete` (líneas 55‑63): quitar las llamadas a `notifySuccess` y `notifyError`. Dejar sólo el `await deleteUser.mutateAsync(...)` dentro del `try/catch` (o simplificar a `mutate` sin `try`).
2. En `confirmRoleChange` (líneas 43‑53): mismo tratamiento — quitar `notifySuccess` y `notifyError` duplicados.
3. Limpiar imports que queden sin uso (`notifySuccess`, `notifyError`, `getErrorMessage` si ya no se usan). Mantener `notifyWarning` que sí se usa en el `useEffect` de correos no resueltos.

### Verificación

- Eliminar un usuario debe mostrar **un solo toast** "Usuario eliminado".
- Cambiar un rol debe mostrar **un solo toast** "Rol actualizado a {rol}".
- Correr `bunx vitest run src/features/admin` para confirmar que los tests existentes (`useUsuario.test.tsx`, `useAdminUsuariosController.test.tsx`) siguen verdes.
- `bun run audit:tests` sin violaciones.

### Changelog

- Bump `APP_VERSION` a `13.85.9`.
- Entrada en `CHANGELOG.md`: `fix(admin/usuarios) doble toast al eliminar usuario y cambiar rol`.

### Fuera de alcance

- No tocar los hooks `useDeleteUser` / `useUpdateUserRole` (la notificación se queda ahí, que es la convención).
- No tocar el segundo `useDeleteUserAuth` ni `useCreateUser` (no presentan el bug).
