
# Plan: Arreglar hallazgos HIGH de la auditoría de calidad

Cinco arreglos puntuales, sin cambios de comportamiento visible para el usuario. Cada uno toca pocos archivos y respeta Power of 10 (≤200 líneas) y los wrappers existentes.

## 1. God component en `TrackingNuevoEventoForm`
**Problema:** el componente importa `supabase` directamente y hace `update` a `embarques` (regla: hooks/services hacen acceso a datos, no componentes).

**Cambios:**
- Nuevo hook `src/hooks/embarque/useActualizarFechaLlegadaReal.ts` que usa `useMutation` + servicio.
- Nuevo servicio `src/services/embarque/mutations/actualizarFechaLlegadaReal.ts` con el `update` y la invalidación de queries.
- `TrackingNuevoEventoForm.tsx` queda solo con UI + `mutateAsync`. Quita `import { supabase }` y `useQueryClient`.

## 2. `supabase.auth.getUser()` repetido en `notasCredito.ts`
**Problema:** tres funciones llaman `auth.getUser()` por separado (latencia + acoplamiento).

**Cambio:** extraer helper local `getCurrentUserId()` o aprovechar `getCurrentUser()` de `@/services/auth` (ya usado en el proyecto). Cada función lo invoca una sola vez. Mantiene la API pública intacta.

## 3. Formato MXN duplicado en `AuditoriaRiesgoFinancieroCard`
**Problema:** `new Intl.NumberFormat("es-MX", { currency: "MXN" })` local en vez del utilitario central.

**Cambio:** reemplazar `fmt.format(...)` por `formatCurrency(..., "MXN", { maximumFractionDigits: 0 })` de `src/lib/formatters/numbers.ts` (verificaré la firma exacta). Borrar la constante `fmt`.

## 4. URL hardcoded `https://wa.me/` en `PlantillaSelector`
**Problema:** URL externa pegada en el componente.

**Cambio:** añadir constantes a `src/constants/externalUrls.ts` (crear si no existe) con `WHATSAPP_SEND_BASE = "https://wa.me/"` y `buildWhatsappUrl(tel, text)`. `PlantillaSelector.tsx` usa la utilidad.

## 5. `deriveErrorCode` señalado como complejo
**Hallazgo revisado:** el archivo `src/lib/ui/errorDetailsExtract.ts:163` ya está refactorizado con helpers (`fromPostgrestCode`, `fromHttpStatus`). La complejidad real es baja. **Acción:** no refactor; añadir un comentario JSDoc breve aclarando el orden de precedencia. (Si prefieres saltarlo del todo, dilo.)

## Versionado y changelog

- `src/constants/appVersion.ts` → bump a `12.51.15`.
- `CHANGELOG.md` → entrada `## [12.51.15] - 2026-06-04` con un bullet por hallazgo.

## Fuera de alcance

- Findings OK del reporte (naming kebab/Pascal, CSV import en `Clientes`/`Proveedores`, ternario en `TesoreriaFlujo`, magic numbers de `staleTime`, literales de roles). Se atacan en otra ronda si lo pides.
- Sin cambios de UI, esquema, RLS, ni migraciones.

## Validación

- Build pasa (`tsc` automático).
- Tests existentes siguen verdes (no se tocan rutas con tests).
- Smoke manual: registrar evento de tracking que dispare confirm de "fecha llegada real", crear/aprobar nota de crédito, abrir plantilla WhatsApp.
