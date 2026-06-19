
# Plan: resolver los 5 issues de Sentry

Analicé cada issue y los agrupé por causa raíz. Hay 3 que requieren código y 2 que sólo hay que cerrar en Sentry porque ya están arreglados o son ruido externo.

---

## 1. REACT-Y — `bl_house` NOT NULL en `embarque_contenedores` (4 usuarios, 8 eventos) 🔧

**Causa:** Al editar un embarque (`/embarques/:id/editar`) se inserta una fila en `embarque_contenedores` sin `bl_house`, y la columna tiene `NOT NULL`. Analogía: es como un formulario que exige un campo obligatorio que la UI permite dejar vacío.

**Arreglo:** Migración que hace `ALTER COLUMN bl_house DROP NOT NULL` y pone `DEFAULT ''`. El BL House se captura después en el flujo operativo, no al crear el contenedor. Es seguro porque ya hay filas con valor y la lógica de validación posterior sigue exigiéndolo cuando corresponde.

---

## 2. REACT-12 — `Failed to fetch` al servicio de correo (1 usuario, release 13.68.6) 🔧

**Causa:** La mejora del 13.68.6 ya muestra el error real: el `fetch` al edge function falla a nivel de red (probablemente cold-start o glitch transitorio del gateway). No es CORS ni auth — el navegador no logra completar la conexión.

**Arreglo:** Añadir reintento automático en `invokeEnviarCotizacion` (`src/features/cotizacion/services/mutations/enviarPorEmail.tsx`):
- Hasta 2 reintentos cuando el error es `TypeError: Failed to fetch` (red), con backoff de 800 ms y 1600 ms.
- No reintentar en errores 4xx/5xx con cuerpo (esos son fallos reales del backend).
- Si los reintentos fallan, mantener el mensaje claro actual.

Analogía: es como volver a marcar un teléfono cuando da tono ocupado, en lugar de rendirse al primer intento.

---

## 3. REACT-10 — `POST /~api/analytics` HTTP 500 (1 usuario, 1 evento) 🙈

**Causa:** Es el tracker interno de Lovable (`~flock.js` → `/~api/analytics`), no código nuestro. Fallo puntual del endpoint de analytics de la plataforma.

**Acción:** Marcar como `ignored` en Sentry con razón "Ruido de tracker externo de Lovable, fuera de nuestro control". No hay código que tocar.

---

## 4. REACT-Z — `FunctionsFetchError` en `/embarques` (release 13.67.3, 2 eventos viejos) ✅

**Causa:** Mismo problema de red en el edge function `exchange-rates`, en una release anterior (13.67.3). Ya no hay eventos recientes.

**Acción:** Aplicar el mismo patrón de reintento al hook que llama a `exchange-rates` (`useExchangeRates` o equivalente) y resolver el issue en Sentry. Si el patrón ya está aislado, lo reutilizo.

---

## 5. REACT-11 — `Failed to send a request to the Edge Function` (release 13.68.4, antes del fix) ✅

**Causa:** Mismo error de email, en una release previa a la 13.68.6. Ya no se reproduce con la mejora de diagnóstico (ahora aparece como REACT-12 con mensaje claro).

**Acción:** Marcar como `resolved` en Sentry (referenciando que se arregló en 13.68.6).

---

## Detalles técnicos

**Archivos a tocar (3):**

1. `supabase/migrations/<timestamp>_bl_house_nullable.sql`
   ```sql
   ALTER TABLE public.embarque_contenedores
     ALTER COLUMN bl_house DROP NOT NULL,
     ALTER COLUMN bl_house SET DEFAULT '';
   ```

2. `src/features/cotizacion/services/mutations/enviarPorEmail.tsx` — envolver el `fetch` en helper `fetchWithRetry` (2 intentos extra, sólo en `TypeError: Failed to fetch`).

3. Hook de exchange-rates (lo localizo primero con `rg`) — aplicar mismo helper o uno compartido en `src/lib/fetchWithRetry.ts`.

**Acciones en Sentry (después de subir el código):**
- `update_issue` REACT-11 → `resolved`
- `update_issue` REACT-Z → `resolved`
- `update_issue` REACT-10 → `ignored` (forever)

**Metadata:**
- `APP_VERSION` → `13.68.7`
- `CHANGELOG.md` → entrada `[13.68.7] - 2026-06-19` con: bl_house nullable, reintentos en edge functions, limpieza de issues de Sentry.

¿Procedo con este plan?
