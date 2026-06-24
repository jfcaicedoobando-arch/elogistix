
## Problema

Los usuarios internos (admin de organización, operadores, etc.) no tienen forma de cambiar su propia contraseña desde la app. Sólo los usuarios del portal de clientes la tienen en `/portal/perfil`. La única alternativa actual es desloguearse y usar "¿Olvidaste tu contraseña?".

**Analogía:** es como una oficina donde sólo los visitantes pueden cambiar la llave de su casillero, pero los empleados no.

## Solución

Agregar la opción "Cambiar contraseña" en el menú de usuario del sidebar (el popover que aparece al hacer click sobre el avatar/email abajo a la izquierda), reutilizando el diálogo que ya existe en el portal.

## Cambios

### 1) Diálogo reutilizable
- **`src/components/shared/dialogs/CambiarPasswordDialog.tsx`** (nuevo, ≤120 líneas)
  - Migrar la lógica del diálogo del portal a un componente compartido.
  - Inputs: contraseña nueva + confirmación, con validación mínima (≥8 caracteres, coinciden).
  - Llama a `supabase.auth.updateUser({ password })` directamente (ya existe `updateUserPassword` en `src/features/auth/services/index.ts`).
  - Usa `FormDialogShell` (regla del proyecto para modales tipo formulario).
  - Toast de éxito/error vía `notifySuccess` / `notifyError`.

### 2) Menú de usuario del sidebar
- **`src/components/layout/SidebarUserMenu.tsx`**
  - Agregar un nuevo `DropdownMenuItem` "Cambiar contraseña" con icono `KeyRound`, entre "Modo claro/oscuro" y "Cerrar sesión".
  - Estado local `cambiarPass` que abre `<CambiarPasswordDialog />`.

### 3) Portal de clientes — refactor de reuso
- **`src/features/portal/routes/PortalPerfil.tsx`** y **`src/features/portal/components/perfil/CambiarPasswordDialog.tsx`**
  - Reemplazar el diálogo del portal por el componente compartido. La función `cambiarPasswordPortal` ya hace lo mismo internamente, así que el comportamiento no cambia para el cliente.

### 4) Versionado y changelog
- **`src/constants/appVersion.ts`** → `13.135.16`
- **`CHANGELOG.md`** → entrada `13.135.16` describiendo la nueva opción en el menú de usuario.

## Lo que NO hago

- No toco políticas de contraseña (longitud mínima, HIBP, etc.) — eso es del lado de Supabase Auth.
- No agrego cambio de email — sólo contraseña, que es lo que preguntaste.
- No cambio el flujo de "¿Olvidaste tu contraseña?" del login.

## Verificación

- Build pasa.
- Probar manualmente: login como `admin@chino.com` → click avatar abajo a la izquierda → "Cambiar contraseña" → diálogo se abre y guarda.
- Portal de clientes sigue funcionando igual.

## Respuesta corta para darle al usuario `admin@chino.com` mientras tanto

> Hoy puedes cambiar tu contraseña cerrando sesión y usando "¿Olvidaste tu contraseña?" en la pantalla de login. Vamos a agregar la opción dentro del menú de usuario del sidebar para que no tengas que salir.
