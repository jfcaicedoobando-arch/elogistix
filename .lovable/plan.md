

# Alta de usuarios desde el módulo de Gestión de Usuarios

## Problema actual
La página de Usuarios solo lista usuarios existentes y permite cambiar roles. No hay forma de que un admin registre nuevos usuarios desde el panel.

## Solución
Agregar un botón "Nuevo Usuario" y un diálogo donde el admin ingrese email, contraseña y rol. Se usará una edge function con el service role key para crear el usuario via `supabase.auth.admin.createUser()`, ya que desde el cliente no se puede crear usuarios en nombre de otro.

## Cambios

### 1. Edge function `create-user`
- Archivo: `supabase/functions/create-user/index.ts`
- Recibe `{ email, password, role }` en el body
- Valida que el solicitante sea admin (verificando JWT + consultando `user_roles`)
- Crea el usuario con `supabase.auth.admin.createUser()` usando el service role key
- Inserta el rol en `user_roles` (o deja que el trigger lo haga y luego actualiza si el rol no es 'viewer')
- Retorna el usuario creado

### 2. Diálogo `NuevoUsuarioDialog` en Usuarios.tsx
- Formulario con campos: email, contraseña (min 6 chars), selector de rol
- Llama a la edge function `create-user`
- Muestra feedback con toast y recarga la lista

### 3. Actualizar `Usuarios.tsx`
- Agregar botón "Nuevo Usuario" en el header
- Integrar el diálogo

### 4. Actualizar `supabase/config.toml`
- Agregar configuración de la función con `verify_jwt = false` (validación manual en código)

### 5. Changelog
- Agregar entrada `v1.4.1` (patch): "Alta de usuarios desde el panel de administración"

## Detalles técnicos
- La edge function usa `SUPABASE_SERVICE_ROLE_KEY` (ya configurado como secret) para operaciones admin
- Validación server-side: se extrae el JWT del header Authorization, se verifica el usuario, y se consulta `user_roles` para confirmar rol admin
- El usuario creado con `admin.createUser({ email_confirm: true })` queda confirmado automáticamente sin necesidad de verificar email

