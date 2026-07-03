## Diagnóstico

- `curl` directo a `POST /facturapi-emitir` con `{"factura_id":"1ea459fa-..."}` respondió **HTTP 412** con `{"error":"org_facturapi_not_configured","message":"Esta organización no tiene FacturApi configurado. Ve a Configuración → Facturación electrónica."}`.
- La edge function funciona bien (el fix del `import` estático `npm:facturapi@4.18.0` de v13.170.11 quedó correcto y los boots son de ~37-61 ms).
- El **bug real que ve el usuario** es de UX en el cliente: `@supabase/supabase-js@2.108` levanta `FunctionsHttpError` en cualquier status ≠2xx y **no** expone el body JSON directamente en `data`. Nuestro `emitirFacturapi`/`cancelarFacturapi` hace `if (error) throw new Error(error.message)` y termina lanzando la cadena genérica `"Edge Function returned a non-2xx status code"`. El mensaje amable del backend (`"Esta organización no tiene FacturApi configurado…"`) queda enterrado en `error.context` (que es la `Response`).

Además, la causa raíz para ESTA org (Elogistix, `00000000-0000-0000-0000-000000000001`) es que no tiene fila en `public.facturapi_credenciales`. Eso se resuelve en Configuración → Facturación Electrónica; **no lo tocamos en este cambio**.

## Objetivo

Que cuando cualquier edge function de facturación responda con un `{error, message}` no-2xx, la UI muestre el `message` real en vez de la cadena genérica de Supabase.

## Cambios

1. **`src/features/facturacion/services/facturapi.ts`** — Introducir helper `parseFunctionError(error, fallbackMsg)` que:
   - Detecta si `error` es `FunctionsHttpError` (o cualquier objeto con `.context` que sea `Response`).
   - Intenta `await error.context.json()` y devuelve `{ status, error, message, issues }`.
   - Si el parseo falla o no hay `context`, devuelve el `fallbackMsg`.
   - Retorno tipado (no `any`).

2. Usar el helper en `emitirFacturapi`:
   - Si hay `error`, parsear body y lanzar `new Error(body.message ?? body.error ?? error.message)`.
   - Si hay `issues[]` (validation), concatenar como hoy.

3. Aplicar el mismo patrón en `cancelarFacturapi` (mismo file).

4. **`src/features/facturacion/services/facturapi.test.ts`** (nuevo o extender existente): test unitario que simula un `FunctionsHttpError`-like con `context: new Response(JSON.stringify({error:"org_facturapi_not_configured", message:"..."}), {status:412})` y verifica que `emitirFacturapi` lanza el mensaje humano, no la cadena genérica.

5. **`src/constants/appVersion.ts`** → `13.170.13`.

6. **`CHANGELOG.md`** → `[13.170.13]` describiendo:
   - El error visible "Edge Function returned a non-2xx status code" al timbrar era genérico; los servicios ahora extraen `{message}` del body de la edge function y lo muestran al usuario.
   - Aclarar que para Elogistix la causa raíz reportada es que falta configurar FacturApi en `Configuración → Facturación Electrónica`; el fix sólo hace visible ese mensaje que ya venía del backend.

## Fuera de alcance

- No configurar credenciales FacturApi para Elogistix (eso lo hace el usuario en Configuración → Facturación Electrónica; el backend ya está listo).
- No tocar la edge function ni la BD.
- No tocar `DialogTimbrarFactura` (el modo inteligente de v13.170.12 sigue igual).

## Verificación

- `bunx vitest run facturapi.test` — el nuevo test pasa.
- Volver a dar click en "Timbrar ahora" en la factura BORRADOR-999948a8d0ab; el toast debe ahora decir **"No se pudo timbrar: Esta organización no tiene FacturApi configurado. Ve a Configuración → Facturación electrónica."** en vez de la cadena genérica.
- Una vez que el usuario configure FacturApi para Elogistix, el timbrado debería completar.
