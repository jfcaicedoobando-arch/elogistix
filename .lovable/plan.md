## Hallazgos en Sentry (últimos 7 días)

| Issue | Mensaje | Ocurrencias | Diagnóstico |
|---|---|---|---|
| `JAVASCRIPT-REACT-1V` | `Object captured as exception with keys: code, details, hint, message` (`22007 invalid input syntax for type date: ""`) | 22 · 3 usuarios · `/costeo/tarifas` | Se envía `""` en un campo `date` de una mutation de tarifas. Además, el `PostgrestError` se pasa **crudo** a `Sentry.captureException`, por eso el título es `SZ`/`OU` (nombre minificado) en vez del mensaje real. |
| `JAVASCRIPT-REACT-1M` | `Object captured as exception with keys: ...` (`23514 Tu rol requiere vincular una cotización Aceptada…`) | 56 · 8 usuarios · `/embarques/:id` | Es una **validación de negocio esperada** (check constraint 23514 lanzado a propósito). No es un bug, pero se reporta como excepción. Mismo problema: objeto crudo pasado a Sentry. |
| `JAVASCRIPT-REACT-2F` | `TypeError: Converting circular structure to JSON` (React reconciler → `HTMLElement.appendChild` → `JSON.stringify`) | 1 · 0 usuarios · `/` | El frame `<anonymous>:103 (HTMLElement.appendChild)` y `<anonymous>:25` no son código nuestro — es una **extensión del navegador** que monkey-parchea `appendChild` y stringifica el DOM (típico de traductores/anti-fraude). |
| `JAVASCRIPT-REACT-2G` | Mismo `Converting circular structure to JSON`, ahora rebotando por el `ErrorBoundary` | 1 · 0 usuarios · `/` | Consecuencia del 2F. |

## Plan

### 1. Normalizar errores antes de `captureException` (arregla 1V + 1M como ruido y mejora agrupación futura)

En `src/lib/observability/reportCaughtError.ts`:
- Si `err` **no** es instancia de `Error`, construir `new Error(err.message ?? "unknown")` conservando `err` como `extra.original`. Así Sentry deja de mostrar títulos minificados (`SZ`, `OU`) y agrupa por mensaje real.
- Copiar `stack` del Error original si existe, o dejar que el nuevo Error lo genere.

### 2. Descartar violaciones de negocio esperadas (arregla 1M en la raíz)

En `reportCaughtError` (o vía `beforeSend` en `sentry/dropPredicate.ts`):
- Si `classified.pgCode === "23514"` **y** `classified.pgHint` existe → tratar como validación esperada: no enviar a Sentry, sólo `logger.info` con breadcrumb. Estos errores ya se muestran al usuario vía `notifyError`; no son crashes.
- Documentar la regla en `mem://preferences/sentry-resolve` (o memoria nueva).

### 3. Arreglar la mutation de tarifas que manda fecha vacía (arregla 1V en la raíz)

- Localizar la mutation que ejecuta `/costeo/tarifas` con `feature: react_query`, `kind: mutation` y produce `22007`. Candidatos: `useCreateTarifa` / `useUpdateTarifa` en `src/features/costeo/**`.
- Antes de mandar al backend, normalizar todo campo `date` opcional: `value === "" ? null : value`. Aplicarlo en el schema Zod / mapper de la mutation, no en el componente.

### 4. Filtrar ruido de extensiones del navegador (arregla 2F/2G)

En `src/lib/observability/sentry/dropPredicate.ts`:
- Descartar eventos cuyo mensaje sea `Converting circular structure to JSON` **y** cuyo stack contenga sólo frames `<anonymous>` fuera de nuestros assets (`/assets/index-*.js`). Es un patrón conocido de extensiones y no accionable.

### 5. Cerrar issues y bumpear versión

- Marcar `1V`, `1M`, `2F`, `2G` como `resolved` con `update_issue` en el mismo turno del fix (mem://preferences/sentry-resolve).
- `APP_VERSION` → `13.300.21`, entrada en `CHANGELOG.md`.

## Detalles técnicos

- **`reportCaughtError` wrapping**: mantener el `err` original en `extra.original` (serializado por Sentry con truncado), pero pasar un `Error` real como primer argumento. Esto elimina el warning "Object captured as exception with keys" que Sentry usa como título fallback.
- **`23514` como no-error**: alternativa a filtrar es mandarlo con `level: 'info'`. Prefiero descartar porque ya llega al usuario vía toast y contamina la lista de bugs reales.
- **Test coverage**: agregar test en `reportCaughtError.test.ts` para (a) wrapping de objetos planos, (b) skip de código 23514.

## Fuera de alcance

- No tocar la lógica de validación de "cotización Aceptada" — funciona como se espera.
- No cambiar el `staleTime` de auditoría (ya se resolvió en 13.300.20).
