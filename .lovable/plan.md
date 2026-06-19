## Problema

Valeria intenta enviar una cotización por correo desde `librecarga.com` y le sale **"Failed to send a request to the Edge Function"**. Los logs del edge function `enviar-cotizacion-email` muestran que arranca (`booted`), pero **nunca recibe el request real** — sólo el preflight OPTIONS, y el navegador lo bloquea.

### Causa raíz (analogía)

El edge function tiene un "portero" (CORS) que decide qué dominios pueden tocar la puerta. El portero actual lo importamos de un paquete fantasma:

```ts
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
```

Ese subpath `/cors` **no existe** en supabase-js, así que `corsHeaders` queda vacío. Resultado: cuando el navegador de Valeria (en `librecarga.com`) pregunta "¿me dejas pasar?", el portero no responde con los permisos correctos y el navegador cancela el request antes de que llegue al servidor. Por eso en los logs no se ve ni un error: nunca llegó.

El resto de edge functions del proyecto ya usan el portero correcto en `supabase/functions/_shared/cors.ts`, que tiene `librecarga.com` y `www.librecarga.com` en la whitelist.

## Cambios propuestos

### 1. `supabase/functions/enviar-cotizacion-email/index.ts`
- Reemplazar `import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'` por `import { buildCors, handlePreflightStrict } from '../_shared/cors.ts'`.
- Usar `handlePreflightStrict(req)` para responder al OPTIONS.
- Usar `buildCors(req)` en todas las respuestas (incluida la helper `json`, que debe recibir `req` o los headers ya construidos).

### 2. `supabase/functions/enviar-cotizacion-email/handlers.ts`
- Mismo reemplazo de import.
- Aceptar headers CORS construidos (pasados desde `index.ts`) y aplicarlos a cada `Response`.

### 3. Metadata
- `APP_VERSION` → `13.68.5`.
- `CHANGELOG.md` → entrada `[13.68.5]` describiendo el fix de CORS en `enviar-cotizacion-email`.

## Verificación

Después del cambio, pedirle a Valeria que reintente desde `librecarga.com`. Si el problema persiste, revisar logs del edge function — ya debería verse el request entrar y cualquier error real (no sólo `booted`).

## No se toca

- Lógica de envío de correos, plantillas, validación de auth, ni la tabla de cotizaciones.
- Otros edge functions.
