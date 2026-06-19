## Plan

1. **Cambiar la llamada del cliente al servicio de correo**
   - En el flujo de “Enviar cotización por email”, dejar de depender de `supabase.functions.invoke()` para este caso.
   - Hacer una llamada `fetch` directa al servicio con encabezados explícitos: `Authorization`, `apikey` y `Content-Type`.
   - Antes de llamar, validar que exista sesión activa; si no, mostrar “Tu sesión expiró, vuelve a iniciar sesión”.

2. **Mejorar el diagnóstico del error**
   - Si el backend responde con error HTTP, leer el cuerpo JSON/texto y lanzar un mensaje útil en vez del genérico “Failed to send a request to the Edge Function”.
   - Mantener el toast copiable con el JSON técnico, para que el siguiente reporte traiga causa real.

3. **Mantener CORS del backend como está, pero verificarlo**
   - Ya confirmé que el preflight desde `https://librecarga.com` responde con los encabezados CORS correctos.
   - Después del ajuste del cliente, probar `prepare`/`send` contra el servicio y revisar logs.

4. **Actualizar metadata del proyecto**
   - Subir `APP_VERSION` a `13.68.6`.
   - Agregar entrada breve en `CHANGELOG.md` explicando el ajuste del envío de cotizaciones.

## Analogía rápida
El backend ya abrió la puerta correcta, pero el mensajero del navegador sigue llegando con credenciales poco claras. Voy a cambiarlo por un mensajero que enseñe explícitamente su identificación y, si algo falla, nos diga exactamente en qué ventanilla se atoró.