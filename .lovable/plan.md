# Estado de preview-transactional-email (solo lectura)

## Lo que sí verifiqué (código de Git, no lo desplegado)
- HEAD local = `8bfc74dec4ecd4ce676928f416fcea4ba3f19d6b` (main con PR390); sin diferencias en `supabase/functions` contra ese commit.
- `supabase/functions/preview-transactional-email/index.ts` línea 3: `import { corsHeaders } from 'npm:@supabase/supabase-js@2.118.0/cors'`.

## Lo que NO puedo verificar
- No tengo acceso a la fuente, hash, ID ni versión de la función desplegada. Ninguna herramienta devuelve el código remoto ni la fecha de su último despliegue.
- No consta en esta conversación ningún despliegue de esta función hecho por mí; por tanto **no hay evidencia de que la versión desplegada tenga el pin 2.118.0**.
- Los logs sólo muestran `booted (time)`; no prueban qué código corre. Publicar frontend no despliega funciones.

## Mecanismo mínimo soportado (cuando lo autorices)
1. Confirmar de nuevo HEAD = `8bfc74de…` y diff vacío en `supabase/functions`.
2. `deploy_edge_functions` con `["preview-transactional-email"]` únicamente (despliega el espacio local; `verify_jwt=false` ya está en `config.toml`, sin cambiarlo). Registrar el `source_sha256` que devuelva.
3. Validación sin correos ni secretos:
   - `OPTIONS` → 200 con los headers CORS esperados.
   - `POST` sin `Authorization` → 401 `{"error":"Unauthorized"}`.
   - `POST` con Bearer ficticio → 401.
   - Preview exitosa (200 con 8 plantillas) requiere la `LOVABLE_API_KEY` real; no la extraeré, así que esa ruta queda sin validar desde aquí (la función nunca envía correo; sólo renderiza).
4. Límite final: el despliegue acredita "envío exitoso + respuestas coherentes", no la identidad byte a byte del código remoto.
