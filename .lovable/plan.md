# Versión 11.67.0 — P1.7 hotspots 4-6 (Zod en boundaries)

## Contexto

Continuación de P1.7. En 11.66.0 cubrimos los 3 hotspots de mayor peso (`dashboard.ts`, `embarqueToDb.ts`, `exportListado.ts`). Ahora avanzamos sobre los siguientes 3 de la lista pendiente, priorizando los que son **boundary real** (no genericidad estructural).

Triage de candidatos por peso:
- `TabSeguridadGlobal.tsx` (peso 12) — **6 casts** sobre el record `config` de `useConfigGlobalCategoria`. Boundary real (JSONB → tipo). ✅ Incluido.
- `embarque/documentos.ts` (peso 12) — **2 casts** sobre la respuesta de la RPC `idempotency_claim`. Boundary real. ✅ Incluido.
- `HallazgosFiltros.tsx` (peso 10) — **4 casts** sobre valores de Radix Select hacia uniones literales. Boundary real (UI string → enum dominio). ✅ Incluido.
- `lib/audit/diffFields.ts` (peso 12) — casts internos de genericidad (`as Record<string, unknown>` para comparar claves). **No es boundary**; Zod no aplicaría sin reescribir la API genérica. ❌ Descartado, queda como deuda aceptada.

## Alcance

### 1. `TabSeguridadGlobal.tsx`

Crear `src/hooks/configuracion/configSchemas.ts`:

- `seguridadConfigSchema`: `{ auto_confirmar_email?: boolean, longitud_minima_password?: number, expiracion_sesion_horas?: number, max_intentos_login?: number, permitir_registro_publico?: boolean }` con defaults.
- `plataformaConfigSchema`: `{ email_soporte?: string }` con default `""`.
- Helper `parseConfigSafe(schema, raw)` que retorna `schema.parse(raw)` con fallback a defaults si hay errores (preserva resiliencia del panel admin).

En `TabSeguridadGlobal.tsx` reemplazar los 6 `as X` por una sola lectura via schema:

```ts
const seg = seguridadConfigSchema.parse(config);
const plat = plataformaConfigSchema.parse(configPlataforma);
setAutoConfirmar(seg.auto_confirmar_email);
// ...
```

### 2. `embarque/documentos.ts`

Crear `src/services/embarque/idempotencyClaimSchema.ts`:

- `idempotencyClaimSchema`: discriminated union vía `.passthrough()`:
  - `{ __idempotency_pending: true }` (pending claim)
  - `{ path: string, fileName?: string }` (cached response)

Reemplazar el bloque `if (claim && typeof claim === 'object' && !Array.isArray(claim)) { const c = claim as Record<string, unknown>; ... c.path as string }` por `safeParse` del schema.

### 3. `HallazgosFiltros.tsx`

Crear `src/components/auditoria/hallazgosFiltrosSchemas.ts`:

- `reglaAuditoriaFiltroSchema` = `z.enum([...10 reglas, "todas"])`
- `severidadFiltroSchema` = `z.enum(["critico", "alto", "medio", "todas"])`
- `filtroRevisionSchema` = `z.enum(["todos", "pendientes", "revisados", "en_progreso"])`
- `filtroResponsableSchema` = `z.enum(["todos", "mios", "sin_asignar", "vencidos"])`

Reemplazar los 4 `onValueChange={(v) => setFiltroX(v as TipoX)}` por `setFiltroX(filtroXSchema.parse(v))` — Radix garantiza que `v` es uno de los `SelectItem.value` listados, así que el `parse` nunca debería lanzar; si lo hace, indica un bug de coherencia entre opciones y enum.

### 4. Tests

- `configSchemas.test.ts`: 2 schemas × {happy, invalid type} = 4 tests.
- `idempotencyClaimSchema.test.ts`: 3 casos (pending, cached, garbage).
- `hallazgosFiltrosSchemas.test.ts`: 1 happy + 1 invalid por schema = 8 tests.

### 5. Versión + changelog

- `src/constants/appVersion.ts` → `11.67.0`.
- `CHANGELOG.md`: entrada `[11.67.0]`.
- `.lovable/plan.md`: añadir los 3 hotspots cubiertos a la lista de P1.7.

## Fuera de alcance

- `diffFields.ts` — descartado (no boundary).
- Otros hotspots de menor peso (peso ≤ 10) — quedan en backlog P1.7.
- D13, Cx — versiones siguientes.

## Verificación

- `bunx vitest run` (tests nuevos + suite completa).
- `audit-report.md` debe seguir 0 HIGH/CRITICAL, 0 oversized.
- `architecture-baseline.test.ts` y `audit-report.test.ts` en verde.

## Entregables

- 3 archivos de schemas + adopción en 3 hotspots.
- 3 archivos de tests (~15 tests).
- `appVersion.ts`, `CHANGELOG.md`, `.lovable/plan.md` actualizados.
