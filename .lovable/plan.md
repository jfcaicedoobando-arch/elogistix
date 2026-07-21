## Auditoría Fase 2 (v13.303.50)

**Estado**: ✅ Sin bugs funcionales. Los mapeos `LC_*` → mensajes es-MX están correctos en `embarques.ts` y `portal.ts`. El `ConfirmActionDialog` en `PlantillasMensajeEditor` cierra bien el estado `aEliminar`. RPCs endurecidos con guards + `FOR UPDATE`.

**Deuda menor detectada** (se cubre al inicio de Fase 3):
- `portal.test.ts` y `embarques.test.ts` no cubren las nuevas ramas de tokens `LC_*` — agregar 6 casos (3 por archivo).
- Sin regresiones en `confirm()` nativo (0 restantes).

---

## Fase 3 · Búsquedas, Dinero y Logs seguros

Objetivo: cerrar tres fixes horizontales de la auditoría v2-2 más higiene de credenciales de test.

### Lote F · FIX-24 · Escape de `ilike`
Los filtros de búsqueda de texto (clientes, proveedores, embarques, facturas, proformas) usan `.ilike('%${q}%')` directo. Un usuario que teclee `%` o `_` obtiene resultados incorrectos y — más importante — cualquier string con `,` o `)` puede romper el operador compuesto `or()` de PostgREST.

- Crear `src/lib/search/ilike.ts` con `escapeIlike(q)` (escapa `\`, `%`, `_`) y `orIlike(cols, q)` (construye la string `or=` con escape + comillas dobles).
- Migrar los ~15 call-sites detectados (grep `\.ilike\(` y `\.or\(.*ilike`) a los helpers.
- Test unitario con cadenas maliciosas (`%`, `_`, `,`, `)`, `"`).

### Lote G · FIX-36 · `NumericInput` unificado
Ya existe el parche global en `ui/input.tsx` (wheel + focus-clear-zero). Falta consolidar los ~8 inputs numéricos que además parsean (`parseInputNumero` en `TablaCostosLocal`, y variantes ad-hoc en pagos, proformas, comisiones).

- Extraer `src/components/ui/NumericInput.tsx` que envuelva `Input type="number"`, aplique `parseInputNumero`, acepte `min/max/step/decimales`, y emita `onValueChange(number | null)`.
- Reemplazar los inputs numéricos en: `TablaCostosLocal`, `BloqueMercancia`, `PagoProveedorFormBody`, `DialogRegistrarPago`, `NotaCreditoForm`, `AnticipoForm`.
- Test de comportamiento (clear-zero, wheel-blur, parse defensivo, decimales).

### Lote H · FIX-42 · Redacción de PII/secretos en logs
`console.warn`/`console.error` y edge-function logs actualmente pueden imprimir tokens, RFCs, emails completos, payloads FacturAPI. Riesgo: fuga en Sentry breadcrumbs y en logs de Cloud.

- Crear `src/lib/logging/redact.ts`: función `redact(obj)` que recorre y enmascara claves sensibles (`authorization`, `api_key`, `token`, `password`, `rfc`, `email`, `curp`, `access_token`, `refresh_token`) y trunca strings > 200 chars.
- Wrapper `safeLog.warn/error(msg, ctx)` que aplica `redact` antes de pasar a `console` o a Sentry.
- Migrar los ~20 `console.warn/error` del código de aplicación (dejar los de edge functions para fase posterior — sólo agregar utilidad server-side equivalente en `supabase/functions/_shared/redact.ts`).
- Config Sentry: `beforeSend` con `redact` sobre `event.extra` y `event.request`.

### Lote I · FIX-01 residual · Limpieza de credenciales hardcodeadas
`scripts/visual-audit/capture.mjs` y `capture.py` traen `1234567890` como password de test.

- Mover a env vars `VISUAL_AUDIT_USER` / `VISUAL_AUDIT_PASS`.
- Fallback: leer de `.env.local` con `dotenv` (ya usado en scripts).
- Documentar en `scripts/visual-audit/README.md`.

### Cierre
- Bump `APP_VERSION` → `13.303.51`.
- Entrada `CHANGELOG.md`.
- Corridas: `bunx vitest run` (nuevos tests) + `bun run lint`.

### Detalle técnico

```text
src/lib/search/ilike.ts          ← nuevo
src/lib/search/__tests__/        ← nuevo
src/lib/logging/redact.ts        ← nuevo
src/lib/logging/safeLog.ts       ← nuevo
src/components/ui/NumericInput.tsx ← nuevo
supabase/functions/_shared/redact.ts ← nuevo

Editados (~30 archivos):
  - Servicios de búsqueda (clientes, proveedores, embarques, facturas, proformas)
  - Formularios numéricos (6 archivos)
  - Sitios de console.warn/error (~20)
  - scripts/visual-audit/capture.{mjs,py}
  - src/config/sentry.ts (beforeSend)
  - src/features/cotizacion/services/conversiones/__tests__/ (cobertura LC_*)
```

**Impacto**: cero cambios funcionales visibles al usuario. Endurece búsquedas, unifica entrada numérica y protege PII en logs/Sentry.

**Riesgos**: los reemplazos de `.ilike/.or` requieren revisión cuidadosa del contrato con PostgREST (comillas dobles para valores con `,`). Se agrega test por cada call-site migrado.
