# Invitación al portal de clientes: cerrar el paso de "crear tu contraseña"

## Qué pasa hoy (verificado en el código)

1. Un administrador invita al cliente desde la ficha del cliente, pestaña Portal, con solo su correo.
2. El sistema crea la cuenta con rol "cliente", la vincula al cliente y manda un correo
   "Te invitaron a Libre Carga" con el botón **Aceptar invitación**.
3. El enlace del correo apunta a `/portal/login`, que solo reenvía a la pantalla de
   inicio de sesión (`/login?audiencia=cliente`).
4. Ahí el cliente ve el formulario de correo + contraseña, **pero nunca definió una
   contraseña**. No existe ninguna pantalla en ese recorrido que se la pida.

Es decir: el correo promete "establecer su contraseña" (así lo dice el propio diálogo de
invitación), y el enlace aterriza en un login donde el cliente no puede entrar. Es un
callejón sin salida.

## Lo que ya existe y sirve

La pantalla `/reset-password` ya hace exactamente lo que falta: valida que haya sesión
activa (la que crea el enlace del correo), pide contraseña nueva con medidor de fuerza y
al guardar envía al login. No hay que construir pantalla nueva.

## Cambio propuesto (mínimo)

1. **Redirigir la invitación a la pantalla de contraseña**: el enlace del correo de
   invitación de cliente (y el de agente, que comparte el mismo defecto) aterrizará en
   `/reset-password` en lugar de `/portal/login`.
2. **Mensaje de bienvenida**: cuando se llegue por invitación, la pantalla dirá
   "Crea tu contraseña para entrar al portal" en vez de "Restablecer contraseña", y al
   terminar enviará al cliente a su portal ya con sesión, sin pedirle iniciar sesión otra vez.
3. **Corregir el destino de respaldo**: si el correo se envía desde un origen no reconocido,
   hoy el enlace cae en el dominio de pruebas; pasará a usar el dominio real
   `librecarga.com`, alineado con el resto de los correos.
4. **Alinear los textos**: el diálogo de invitación y la plantilla de correo describirán el
   paso real ("Aceptar invitación y crear contraseña").

Nada más cambia: sigue creándose la cuenta y el vínculo al invitar, los roles y los
permisos del portal quedan igual, y no se toca el flujo de "olvidé mi contraseña".

## Detalle técnico

- `supabase/functions/user-management/clientHandlers.ts`: `resolveRedirectTo(origin)` pasa de
  `${origin}/portal/login` a `${origin}/reset-password?origen=invitacion`; el respaldo cuando el
  origen no está en la lista blanca pasa de `https://elogistix.lovable.app` a
  `https://librecarga.com`. Mismo ajuste en `agenteHandlers.ts`.
- `src/features/auth/routes/ResetPassword.tsx`: lee `?origen=invitacion` (o `audiencia`) para
  cambiar título/copy y, al guardar la contraseña, navegar a la ruta de aterrizaje por rol en vez
  de `/login` (reutilizando el resolvedor de destino ya existente en el login). Sin tocar la
  lógica de sesión ni la política de contraseñas.
- `supabase/functions/_shared/email-templates/invite.tsx` y `PortalInviteDialog.tsx`: copy alineado.
- Redespliegue de la Edge Function `user-management` (y `auth-email-hook` solo si se edita su plantilla).
- Sin cambios de base de datos, sin migraciones, sin tocar `client_users` ni RLS.

## Pruebas focalizadas

- Unitaria de `resolveRedirectTo`: origen permitido, origen desconocido (respaldo a
  `librecarga.com`), y que la ruta sea `/reset-password?origen=invitacion`.
- Render de `ResetPassword` con `?origen=invitacion`: muestra copy de bienvenida y, al guardar,
  navega al portal; sin el parámetro conserva el comportamiento actual.
- Smoke de rutas: `/reset-password` sigue siendo pública.

CI completo, pruebas de reglas de acceso y E2E quedan para GitHub Actions.
