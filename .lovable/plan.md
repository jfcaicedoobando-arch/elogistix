## Diagnóstico

El CI falla por 3 problemas — todos consecuencia del trabajo reciente de proformas (envío por email + portal público + respuesta manual). No hay bugs nuevos, sólo faltan marcadores/patrones exigidos por las reglas del proyecto.

### 1. Casts sin marcador `SAFE-CAST` (bloquea 3 tests)

`src/features/proformas/services/portalPublico.ts`, líneas 45 y 66, tiene `as unknown as` sin el comentario `// SAFE-CAST:` requerido. Esto revienta:
- `src/lib/__tests__/architecture.test.ts` — regla "no hay `as unknown as` sin SAFE-CAST".
- `src/__tests__/architecture/safe-casts-services.test.ts` — 0 casts HIGH/CRITICAL en `src/features/**/services/**`.
- `src/__tests__/audit-report.test.ts` — baseline global 0 HIGH/CRITICAL.

Los dos casts corresponden a las respuestas de los RPC públicos `portal_obtener_proforma_por_token` y `portal_responder_por_token` (tipos generados no reflejan el shape real del JSON de retorno). Es exactamente el caso legítimo de SAFE-CAST: RPC returns.

### 2. `toast({ variant: "destructive" })` en vez de `notifyError` (bloquea 1 test)

`src/__tests__/architecture/error-toasts-use-notifyError.test.ts` señala 4 usos prohibidos:

- `src/features/proformas/components/EnviarProformaDialog.tsx:71, 89`
- `src/features/proformas/components/RespuestaClienteManualDialog.tsx:52, 70`

La política es usar `notifyError(toast, { title, error, method })` desde `@/components/shared/utils/appFeedback`.

### 3. Edge function `enviar-proforma-email` sin cobertura de Sentry (bloquea 1 test)

`src/__tests__/architecture/sentry-edge-coverage.test.ts` exige que toda edge function con `index.ts` esté cubierta por Sentry. La nueva `supabase/functions/enviar-proforma-email/index.ts` no está listada en ninguno de los conjuntos (MANUAL_COVERAGE, CRITICAL wrapped, ni SENTRY_EXEMPT).

La función maneja auth, envía correo y escribe en la BD → merece Sentry real (no proxy exento). El patrón estándar en el repo es `wrapEdgeHandler` con clasificación CRITICAL, o cobertura manual con `logToSentry` + `authenticateRequest`.

## Cambios propuestos

### A. `src/features/proformas/services/portalPublico.ts`

Añadir marcador SAFE-CAST arriba de cada `as unknown as` con la razón. Ejemplo:

```ts
// SAFE-CAST: RPC portal_obtener_proforma_por_token retorna JSON validado por el
// backend con shape distinto al inferido por supabase-js.
return data as unknown as ProformaPortalDTO;
```

Sin cambios funcionales.

### B. Toasts destructivos → `notifyError`

En los 2 archivos (`EnviarProformaDialog.tsx`, `RespuestaClienteManualDialog.tsx`) reemplazar cada:

```ts
toast({ variant: "destructive", title: "...", description: "..." });
```

por:

```ts
notifyError(toast, { title: "...", error, method: "PROFORMAS_ENVIAR_1" });
```

siguiendo el patrón ya usado en `DialogCategoria.tsx` (ver contexto). Los `method` codes serán únicos por sitio.

### C. Sentry en `enviar-proforma-email`

Envolver el handler con `wrapEdgeHandler` (patrón estándar) y agregar `supabase/functions/enviar-proforma-email` a la lista `CRITICAL` en `src/__tests__/architecture/sentry-edge-wrapping.test.ts`.

Esto también deja la función dentro del scope de `authenticateRequest` (auth centralizada), pero como ya autentica manualmente, se puede mantener la lógica interna intacta salvo el wrapping externo.

### D. Bump de versión y changelog

- `APP_VERSION` → `13.144.6`
- Entrada en `CHANGELOG.md` describiendo "arreglos de CI post-proformas: SAFE-CAST markers, notifyError, Sentry en enviar-proforma-email".

## Fuera de alcance

- No se modifica el comportamiento de negocio de proformas.
- No se tocan los tests de arquitectura ni sus umbrales — sólo el código para que cumplan.
- No se rehacen los diálogos ni el portal público.

## Verificación

Al terminar, correr localmente (o en CI):

```
bun run lint -- --max-warnings 0
bunx vitest run src/lib/__tests__/architecture.test.ts \
  src/__tests__/architecture/error-toasts-use-notifyError.test.ts \
  src/__tests__/architecture/safe-casts-services.test.ts \
  src/__tests__/architecture/sentry-edge-coverage.test.ts \
  src/__tests__/audit-report.test.ts
```

Todos deben pasar.
