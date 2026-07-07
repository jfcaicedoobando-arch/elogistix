## Problema

Un visitante de `librecarga.com` hace clic en **"Probar demo"** y no pasa nada visible: el botón se queda cargando y luego falla. Reproducido con Playwright contra producción.

## Causa

En la consola del navegador aparece:

```
Access to fetch at 'https://…supabase.co/functions/v1/demo-access'
from origin 'https://librecarga.com' has been blocked by CORS policy:
Request header field baggage is not allowed by Access-Control-Allow-Headers
in preflight response.
```

Sentry (activo en producción) inyecta los headers `sentry-trace` y `baggage` en fetches que matchean `tracePropagationTargets`, incluyendo `*.supabase.co/functions/v1`. El navegador dispara un preflight `OPTIONS` y la respuesta no autoriza esos headers → cancela el POST.

Este mismo bug ya se corrigió en el resto de edge functions en la v13.114.13 mediante el helper compartido `_shared/cors.ts`, que incluye `sentry-trace, baggage` en `ALLOW_HEADERS`. Pero `supabase/functions/demo-access/index.ts` sigue usando un `corsHeaders` **local hardcodeado** que quedó fuera de esa migración:

```ts
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
```

Es un endpoint público por diseño (sin JWT) → aplica `corsHeaders` wildcard del shared.

## Fix

**`supabase/functions/demo-access/index.ts`:**

1. Reemplazar el `corsHeaders` local por el import del shared:
   ```ts
   import { corsHeaders } from "../_shared/cors.ts";
   ```
2. Borrar la constante local.
3. El resto del handler (OPTIONS + Response con headers) queda idéntico.

Con eso, el preflight autoriza `sentry-trace, baggage` (y los `x-supabase-client-*` que el SDK v2.95+ también envía) y el botón vuelve a funcionar en `librecarga.com`.

## Verificación

- Deploy de `demo-access`.
- Playwright contra `https://librecarga.com`: click en "Probar demo" → esperar redirect a `/inicio` y screenshot post-navegación.
- Confirmar en logs de la edge function una invocación 200 nueva (ahora sólo hay `booted`).

## Fuera de alcance

- No se toca el flujo de `enterDemoMode`, la RPC `seed_demo_organization`, ni el frontend.
- No se cambian dominios permitidos ni políticas.

## Registro

- Bump `APP_VERSION` a `13.209.4`.
- Entrada en `CHANGELOG.md` [13.209.4] — Fix: botón "Probar demo" fallaba en `librecarga.com` por CORS (`baggage`/`sentry-trace`); ahora usa el helper `_shared/cors.ts`.

## Analogía

Es como un guardia en la puerta de un edificio que sólo deja entrar visitas con una lista muy corta de credenciales aceptadas. Sentry, sin avisar, le añadió dos credenciales nuevas a cada visitante (`sentry-trace` y `baggage`). Como el guardia de `demo-access` nunca fue actualizado, rechazó a todos los visitantes que venían de `librecarga.com`. Cambiamos ese guardia por el "estándar del edificio" que ya conoce las credenciales nuevas.
