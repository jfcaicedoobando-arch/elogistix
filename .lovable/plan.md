## Contexto

Sentry reportó otra vez `JAVASCRIPT-REACT-12` en la release `13.68.7`:

> Error: No se pudo contactar al servicio de correo: Failed to fetch (eorqadkulqtneqjbsblk.supabase.co)

- Usuario en Edge / Windows / EE.UU., rol `coordinador_logistico`.
- 2 ocurrencias en ~13 min sobre la cotización `e8906923-...`.
- Los logs de la edge function `enviar-cotizacion-email` **no muestran ninguna invocación** durante esa ventana → la petición murió en el navegador antes de salir (no llegó a Supabase).
- El retry que metimos en `13.68.7` (3 intentos: 0 / 800 / 1600 ms) tampoco logró pasar.

Analogía: es como llamar por teléfono y que la llamada se corte antes de timbrar. Por eso reintentar rápido 3 veces no sirve — la línea sigue caída. Probablemente: red intermitente, proxy/antivirus corporativo, o el usuario quedó offline un momento.

## Qué voy a cambiar (solo presentación + resiliencia, sin tocar lógica de negocio)

### 1. `src/features/cotizacion/services/mutations/enviarPorEmail.tsx`

- **Backoff más largo y con más intentos**: 5 intentos en 0 / 1s / 2s / 4s / 8s (≈15s totales) en vez de los 3 actuales (≤2.4s). Cubre microcortes de red típicos.
- **Detectar offline antes de intentar**: si `navigator.onLine === false`, lanzar de inmediato un mensaje claro: *"Tu conexión a internet está caída. Reconéctate e intenta de nuevo."* — así el usuario sabe el porqué y no esperamos 15s en vano.
- **Espera-a-volver-online entre reintentos**: si tras un fallo `navigator.onLine === false`, esperar hasta el evento `online` (con tope de 10s) antes del siguiente intento.
- **Mensaje final más útil** cuando los 5 intentos fallan: pedir revisar VPN / antivirus / red corporativa, además del error técnico.

### 2. `src/features/cotizacion/services/mutations/__tests__/enviarPorEmail.test.ts` (nuevo)

Pruebas mínimas:
- Reintenta 5 veces ante `TypeError: Failed to fetch` y devuelve el último error con mensaje amigable.
- No reintenta ante errores HTTP 4xx/5xx con cuerpo (los propaga tal cual).
- Si `navigator.onLine === false`, falla rápido sin tocar `fetch`.

### 3. Changelog + versión

- Bump `APP_VERSION` a `13.68.8` en `src/constants/appVersion.ts`.
- Entrada en `CHANGELOG.md` describiendo el retry extendido y la detección offline.

### 4. Sentry

Marcar `JAVASCRIPT-REACT-12` como `resolvedInNextRelease` al desplegar `13.68.8`, para que reaparezca solo si vuelve a ocurrir en una release posterior.

## Qué NO voy a tocar

- La edge function `enviar-cotizacion-email` (los logs confirman que no recibió la petición — el problema es de red del cliente, no del servidor).
- CORS / auth headers (ya están correctos, el `fetch` ni siquiera salió).
- La generación del PDF ni el flujo `prepare → upload → send`.
