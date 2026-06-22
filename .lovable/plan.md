## Objetivo

Hacer que la subida de CSF (PDF) y de CFDI (XML) sea resistente a fallos de red transitorios (WiFi inestable, proxy corporativo). Hoy, si la conexión se cae a mitad del request, el usuario ve `TypeError: Failed to fetch` y tiene que reintentar manualmente.

## Analogía

Como cuando llamas por teléfono y se corta la señal: en vez de hacerte marcar tú otra vez, el teléfono vuelve a marcar solo 1–2 veces, espera un poquito entre intentos, y si después de 60 segundos sigue sin contestar, te avisa.

## Cambios

### 1. Nuevo helper compartido: `src/lib/net/fetchWithRetry.ts`
Función `fetchWithRetry(url, init, opts)` que:
- Aplica `AbortController` con timeout configurable (default 60s).
- Reintenta hasta 2 veces (3 intentos totales) sólo si el error es `TypeError: Failed to fetch`, `AbortError` por timeout, o respuesta HTTP 5xx/408/429.
- Backoff: 1s, luego 3s.
- NO reintenta en 4xx (errores de validación del servidor) ni si el body ya se consumió.
- NO reintenta uploads con `FormData` que contengan un `File` ya leído… en realidad sí podemos reintentar porque el `File` es re-leíble desde disco; sólo armamos el `FormData` dentro del closure de cada intento.

### 2. `src/features/cliente/services/csf/index.ts`
Reemplazar el `fetch` directo por `fetchWithRetry`. El `FormData` se construye dentro del callback de reintento para evitar consumir el stream del PDF en el primer intento fallido.

### 3. `src/features/cxp/services/parseCfdi.ts`
Mismo cambio en `callEdgeFunction`. Mantener los breadcrumbs de Sentry existentes y agregar uno extra por reintento (`parse_cfdi_xml.retry` con `attempt` y `reason`).

### 4. Tests
- `src/lib/net/__tests__/fetchWithRetry.test.ts`: cubre éxito al 1er intento, éxito tras retry, falla definitiva tras agotar intentos, timeout, no-reintento en 4xx.
- Actualizar `parseCfdi.test.ts` y `csf/__tests__/index.test.ts` para confirmar que siguen pasando (mismo contrato externo).

### 5. Versionado y changelog
- `APP_VERSION` → `13.114.0`.
- Entrada en `CHANGELOG.md` describiendo la mejora de resiliencia.

## Detalles técnicos

```ts
// src/lib/net/fetchWithRetry.ts (firma)
export interface RetryOptions {
  timeoutMs?: number;        // default 60_000
  maxAttempts?: number;      // default 3
  backoffMs?: number[];      // default [1000, 3000]
  buildInit?: () => RequestInit; // para FormData fresca por intento
}
export async function fetchWithRetry(
  url: string,
  initOrBuilder: RequestInit | (() => RequestInit),
  opts?: RetryOptions,
): Promise<Response>;
```

Criterio de reintento:
```ts
const isTransient =
  err?.name === "TypeError" && /failed to fetch/i.test(err.message)
  || err?.name === "AbortError"
  || (res && [408, 429, 500, 502, 503, 504].includes(res.status));
```

## Lo que NO se toca

- Edge functions `parse-csf` y `parse-cfdi-xml` (backend ya está sano).
- UI de los componentes (`CargaCfdiSection`, wizards de cliente/proveedor): siguen mostrando el toast de error existente si los 3 intentos fallan.
- Otros llamados a `fetch` en el proyecto (fuera de alcance).

## Validación

- Tests unitarios del helper y de los servicios afectados pasan.
- Build limpio.
- Manual: simular red caída con DevTools throttling "Offline" y verificar que se vean 2 reintentos en consola antes del error final.
