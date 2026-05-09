## Objetivo

Evitar llamadas fallidas a JSONCargo cuando el prefix del contenedor (4 letras iniciales) no pertenece a la naviera registrada, y guiar al usuario a corregir la naviera mostrando sugerencias.

## Cambios

### 1. Catálogo local de prefixes → navieras
**Nuevo archivo:** `src/lib/jsoncargo/containerPrefixes.ts`
- Mapa estático de prefixes BIC conocidos a las 11 navieras soportadas por JSONCargo (MAERSK, MSC, CMA_CGM, COSCO, HAPAG_LLOYD, HMM, ONE, EVERGREEN, ZIM, YANG_MING, PIL).
- Helpers:
  - `extractPrefix(container: string): string | null` — extrae primeras 4 letras alfabéticas.
  - `getCarriersForPrefix(prefix: string): JsonCargoShippingLine[]` — devuelve navieras que usan ese prefix.
  - `validatePrefixMatchesNaviera(container, naviera): { valid, suggestions }` — valida coincidencia y devuelve sugerencias si no coincide.
- Notas: TEMU típicamente pertenece a Evergreen / contenedores leasing; el catálogo cubrirá los prefixes más comunes (MAEU, MSKU, MSCU, CMAU, COSU, HLXU, HLBU, HMMU, ONEU, EGHU, EISU, EITU, TEMU, ZIMU, YMLU, YMMU, PCIU, etc.).

### 2. Validación previa en hook
**Edita:** `src/hooks/embarque/useJsonCargoTracking.ts`
- Antes de invocar la edge function `jsoncargo-track`, ejecutar `validatePrefixMatchesNaviera`.
- Si no coincide: NO llamar al API. Devolver un error estructurado `{ code: 'PREFIX_MISMATCH', prefix, naviera, suggestions }`.
- El `useMutation` propaga ese error a la UI sin consumir cuota.

### 3. UI mejorada en la tarjeta de tracking
**Edita:** `src/components/embarque/TrackingLiveCard.tsx`
- Cuando el error sea `PREFIX_MISMATCH` (o el backend devuelva el texto "Prefix not found"):
  - Mostrar Alert (variant destructive) con copy claro:
    > "El prefix **TEMU** del contenedor no coincide con la naviera **ZIM** registrada. Verifica que la naviera sea correcta."
  - Listar sugerencias: "Este prefix suele pertenecer a: **Evergreen**" como badges.
  - CTA secundario: link "Editar embarque" que navega al detalle en modo edición (tab General) para corregir naviera.
  - Si no hay sugerencias en el catálogo local, mostrar mensaje genérico + indicación de contactar `support@jsoncargo.com` para registrar el prefix.
- En modo portal cliente: mostrar solo el mensaje informativo, sin CTA de edición.

### 4. Manejo del error del backend (defensa en profundidad)
**Edita:** `supabase/functions/_shared/jsoncargo.ts` y `supabase/functions/jsoncargo-track/index.ts`
- Detectar respuestas con texto `Prefix not found` y devolver `{ error_code: 'PREFIX_MISMATCH', prefix, naviera, message }` con HTTP 422 en vez de 500.
- Registrar `status='prefix_mismatch'` en `tracking_externo` para evitar reintentos automáticos del job batch.

### 5. Skip en batch diario
**Edita:** `supabase/functions/jsoncargo-track-batch/index.ts`
- Antes de llamar `jsoncargo-track` por cada embarque, validar prefix contra naviera usando un mini-catálogo embebido (mismo dataset).
- Si no coincide: saltar embarque y registrar en `bitacora_actividad` con motivo, sin consumir cuota del API.

### 6. Changelog y versión
**Edita:** `src/constants/appVersion.ts` → `8.131.0`
**Edita:** `src/content/changelog/v8/chunks/0.ts` y `src/content/changelogData.ts` con entrada describiendo: validación previa de prefix, mensajes de error con sugerencias y skip automático en sincronización batch.

## Archivos tocados
- Nuevo: `src/lib/jsoncargo/containerPrefixes.ts`
- Edita: `src/hooks/embarque/useJsonCargoTracking.ts`
- Edita: `src/components/embarque/TrackingLiveCard.tsx`
- Edita: `supabase/functions/_shared/jsoncargo.ts`
- Edita: `supabase/functions/jsoncargo-track/index.ts`
- Edita: `supabase/functions/jsoncargo-track-batch/index.ts`
- Edita: `src/constants/appVersion.ts`, `src/content/changelog/v8/chunks/0.ts`, `src/content/changelogData.ts`

## Fuera de alcance
- Auto-corrección de naviera (descartado por el usuario).
- Reintentos automáticos con todas las navieras (descartado).
- Migración de BD (no se requiere; el catálogo es estático en código).
