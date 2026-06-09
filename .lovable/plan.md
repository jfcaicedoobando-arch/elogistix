## Objetivo
Mejorar la pantalla `/usuarios` para que, cuando la edge function `user-management` falle y no se puedan resolver los emails de los usuarios:
1. No se muestren UUIDs crudos en la columna Email.
2. Se emita un toast de advertencia/aviso al usuario.

## Cambios

### 1. Servicio de usuarios — fallback limpio
**Archivo:** `src/services/usuario/index.ts`
- En `fetchUsuariosOrganizacion`, cuando la edge function (`user-management`) falle, el fallback del campo `email` cambia de `m.user_id` (UUID crudo) a `"No disponible"`.
- Se mantiene la estructura de datos; no se lanza error global para no bloquear la tabla.

### 2. Componente de usuarios — toast de advertencia
**Archivo:** `src/pages/admin-org/Usuarios.tsx`
- Agregar un `useEffect` que observe el array de usuarios cargado (`users`).
- Si detecta algún usuario con `email === "No disponible"`, emitir un toast de tipo `warning` (vía `notifyWarning`) con un mensaje del tipo: "No se pudieron resolver los correos de X usuario(s). Verifica la conexión con el servidor de autenticación."
- El efecto debe limpiarse / deduplicarse para no repetir el toast en cada render.

### 3. Columnas de la tabla — estilo visual para dato faltante
**Archivo:** `src/pages/admin-org/usuariosColumns.tsx`
- En la celda de la columna `email`, cuando el valor sea `"No disponible"`, renderizarlo con estilo `text-muted-foreground italic` (o similar) para diferenciarlo visualmente de un email real.

### 4. Versionado
- Bump de `APP_VERSION` a `12.64.6`.
- Entrada en `CHANGELOG.md`.

## Reglas de diseño
- Usar `notifyWarning` de `@/components/shared/utils/appFeedback` para consistencia con el resto de la app.
- No modificar el tipo `UserRow` para mantener compatibilidad con otros consumidores.
- El toast debe ser no-bloqueante (warning) porque la tabla sigue siendo funcional.