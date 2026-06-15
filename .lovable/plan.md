## Plan

1. **Corregir el RPC de logging**
   - Cambiar `public.log_client_error_v1` para que `p_request_id` sea `uuid` en lugar de `text`.
   - Eliminar cualquier posibilidad de insertar texto en `app_logs.request_id`.
   - Dar permisos de ejecución a los roles que ya usan la función.
   - Quitar la firma anterior con `p_request_id text` para evitar que el backend invoque una versión ambigua o vieja.

2. **Mantener la Edge Function compatible**
   - Conservar la normalización actual de `requestId` en `client-error-log`: si el header trae UUID válido, se usa; si no, se genera uno nuevo.
   - Enviar siempre un UUID válido al RPC.
   - Mejorar el manejo de error para que el logging no vuelva a generar un error secundario por `request_id`.

3. **Endurecer logging compartido**
   - Revisar `_shared/logger.ts`, porque también escribe directo en `app_logs.request_id` usando headers `x-request-id`/`x-correlation-id`.
   - Validar esos headers como UUID y generar uno nuevo si no cumplen el formato.

4. **Validación**
   - Probar `client-error-log` con:
     - `x-request-id` UUID válido.
     - `x-request-id` inválido.
     - Sin header.
   - Confirmar que responde `200` y que `app_logs.request_id` recibe UUID válido.

5. **Registro de cambio**
   - Bump de versión patch.
   - Actualizar `CHANGELOG.md` con el fix del logging de errores cliente.