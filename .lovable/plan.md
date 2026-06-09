## Diagnóstico

- En publicado (`librecarga.com`) el síntoma apunta a `user-management` bloqueado antes del `POST`: los logs recientes muestran múltiples `OPTIONS 200` hacia `user-management`, pero no aparece el `POST` correspondiente.
- Eso explica que `/usuarios` y `/comisiones` caigan a datos de `organization_members` / `vendedora_config`, donde sólo existe `user_id`.
- `/usuarios` ya tuvo un fallback visual parcial (`No disponible`), pero `comisiones` sigue usando `fetchAvailableUsers()` y cuando falla muestra UID en:
  - selector de vendedoras
  - configuración de porcentajes
  - embarques sin vendedora asignada
- El cambio de CORS anterior en `_shared/cors.ts` está en código, pero falta hacerlo más robusto y verificable para producción: permitir explícitamente el dominio custom publicado, devolver métodos/headers correctos en preflight y agregar pruebas para `librecarga.com`.

## Plan de implementación

1. **Endurecer CORS de edge functions autenticadas**
   - Ajustar `supabase/functions/_shared/cors.ts` para que el preflight estricto incluya explícitamente:
     - `Access-Control-Allow-Methods: POST, OPTIONS`
     - `Access-Control-Max-Age`
     - dominios exactos `https://librecarga.com`, `https://www.librecarga.com`, `https://elogistix.lovable.app`
   - Mantener soporte a previews `.lovable.app` y `.lovableproject.com`.
   - Agregar pruebas en `supabase/functions/_shared/cors_test.ts` para validar ambos dominios de Libre Carga y que el preflight contiene métodos.

2. **Hacer visible el error real de `user-management` en frontend**
   - Cambiar `fetchUsuariosOrganizacion()` para no tragarse silenciosamente el error de `supabase.functions.invoke("user-management")`.
   - Mantener la tabla funcional, pero registrar/propagar una bandera interna de resolución incompleta para que el toast de `/usuarios` sea correcto.
   - Corregir el comentario obsoleto que aún dice “mostramos el user_id como fallback”.

3. **Unificar el fallback de emails para evitar UIDs en comisiones**
   - Reutilizar `UNRESOLVED_EMAIL = "No disponible"` en `src/services/comisiones/vendedoras.ts`.
   - Cambiar estos fallbacks:
     - `nombre: map[id] ?? id` → `"No disponible"`
     - `email: map[id] ?? ""` → `"No disponible"`
     - `nombre/email` en `fetchVendedorasConfig()` → `"No disponible"` cuando no se resuelva.
   - Así, si `user-management` vuelve a fallar, comisiones ya no expondrá UIDs.

4. **Agregar aviso en módulo de comisiones**
   - En `src/pages/comisiones/Comisiones.tsx`, detectar vendedoras con email/nombre `No disponible`.
   - Mostrar un `notifyWarning` deduplicado tipo: “No se pudieron resolver los correos de X vendedora(s). Verifica la conexión con el servidor de autenticación.”
   - Evitar repetir el toast en cada render.

5. **Ajustar UI donde aún puede aparecer UID**
   - En `TabVendedorasConfig`, si una vendedora configurada no se resuelve, mostrar `No disponible` con estilo muted/italic, no `c.user_id`.
   - En selects de comisiones, mostrar `No disponible` como texto legible.

6. **Tests y versionado**
   - Actualizar tests Deno de CORS.
   - Agregar/ajustar tests de hooks/servicios si aplica para cubrir que no se muestra UID como fallback.
   - Bump `APP_VERSION` a `12.64.7`.
   - Agregar entrada en `CHANGELOG.md` explicando el fix de producción para `user-management` + comisiones.

## Validación esperada

- En backend: preflight desde `https://librecarga.com` devuelve `Access-Control-Allow-Origin: https://librecarga.com` y permite `POST`.
- En publicado: `user-management` debe registrar `POST` después del `OPTIONS`.
- En frontend: si la función falla por cualquier razón, `/usuarios` y `/comisiones` muestran `No disponible` + toast, nunca UIDs crudos.