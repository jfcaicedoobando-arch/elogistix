## Problema

En Sentry aparece `FunctionsFetchError: Failed to send a request to the Edge Function` cada vez que el navegador no logra contactar la edge `exchange-rates` (cold start del servidor, micro-corte de red del cliente, AdBlock, etc.).

El error está **manejado** (`handled: yes`) — React Query reintenta y la app ya tiene un fallback duro (17.25 / 18.5). Es ruido de Sentry, no un bug funcional. La analogía: es como reportar al jefe cada vez que el WiFi parpadea un segundo, aunque el teléfono se reconectó solo.

## Causa

`fetchExchangeRates` reporta **cualquier** error (incluido el de red transitorio) a Sentry y lo relanza. El proveedor (Frankfurter) ya cuenta con fallback dentro de la edge, pero ese fallback nunca llega si la petición ni siquiera sale del navegador.

## Cambios propuestos

1. **`src/features/catalogos/services/index.ts`** — `fetchExchangeRates`:
   - Si el error es `FunctionsFetchError` (fallo de red al invocar), **NO** capturar en Sentry; sólo dejar un `addBreadcrumb` y devolver `FALLBACK` (17.25 / 18.5) en vez de lanzar. Así React Query no reintenta inútilmente y la UI sigue funcionando.
   - Para otros errores (5xx del edge, JSON inválido), mantener el `captureException` actual y relanzar (comportamiento sin cambios).

2. **`src/features/catalogos/services/__tests__/exchangeRates.sentry.test.ts`**:
   - Añadir caso: cuando `invoke` devuelve un error con `name === "FunctionsFetchError"`, la función **devuelve el fallback** y **no** llama a `captureException`.
   - Conservar el test existente para errores genéricos (siguen reportándose y relanzándose).

3. **`src/constants/appVersion.ts`** → `13.67.8`.

4. **`CHANGELOG.md`** → entrada `[13.67.8]` describiendo el silenciado del ruido de Sentry para fallos de red transitorios.

## Fuera de alcance

- No tocar la edge function `exchange-rates` (ya tiene su propio fallback).
- No cambiar `verify_jwt`, CORS, ni `config.toml`.
- No cambiar UI ni lógica de facturación.
