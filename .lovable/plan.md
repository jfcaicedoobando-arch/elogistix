## Contexto

El CI falla en el step **Lint, typecheck, unused code & build** por 3 reglas de auditoría arquitectónica introducidas en los cambios recientes de captación de leads (DemoAccessDialog, useUtmParams, demoLeads, Onboarding):

1. **Power of 10 #4 — archivos > 200 líneas** (fuera de allowlist):
   - `src/features/onboarding/routes/Onboarding.tsx` → 203 líneas
   - `src/features/marketing/components/DemoAccessDialog.tsx` → 201 líneas
2. **Jerarquía de capas** — `features/*/services` no puede importar de `hooks/`:
   - `src/features/marketing/services/demoLeads.ts` importa `getAttribution` desde `@/features/marketing/hooks/useUtmParams`.
3. **Casts baseline (0 HIGH / 0 CRITICAL)** — 1 CRITICAL introducido:
   - `src/features/marketing/hooks/useUtmParams.ts:58` usa `JSON.parse(raw) as Partial<Attribution>`.

Tres archivos de tests validan estas baselines y ahora rompen (`architecture.test.ts`, `architecture-baseline.test.ts`, `audit-report.test.ts`). El resto del CI (unit shards, edge functions, lint, typecheck, build) pasa.

## Plan (build mode)

### 1. Separar utilidad pura del hook (arregla #2 y prepara #3)

Crear `src/features/marketing/lib/attribution.ts`:
- Mover `Attribution`, `EMPTY`, `STORAGE_KEY` y `getAttribution()` desde `useUtmParams.ts`.
- Reemplazar el cast CRITICAL por parseo defensivo: leer con `JSON.parse` sin cast, validar que sea objeto, y proyectar sólo las llaves conocidas (`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `referrer`, `landing_path`) haciendo `typeof x === "string" ? x : null`. Sin `as`.

Reducir `useUtmParams.ts` a sólo el hook `useCaptureUtmParams` (importa constantes desde `lib/attribution`).

Actualizar imports:
- `demoLeads.ts` → `import { getAttribution } from "@/features/marketing/lib/attribution"`.
- Cualquier otro consumidor de `getAttribution` (verificaré con `rg`) apunta a `lib/attribution`.

### 2. Bajar `Onboarding.tsx` de 203 a ≤ 200 líneas

Extraer el bloque de validación de RFC/dirección + botón "Configurar después" a un helper pequeño en `src/features/onboarding/lib/onboardingValidation.ts` (función pura que recibe los campos y devuelve `{ ok: true } | { ok: false, message: string }`). Deja el componente a ~180 líneas sin cambiar UX.

### 3. Bajar `DemoAccessDialog.tsx` de 201 a ≤ 200 líneas

Extraer el schema Zod del formulario y el tipo `DemoAccessFormValues` a `src/features/marketing/lib/demoAccessSchema.ts`. El componente sólo importa el schema/tipo. Baja ~20 líneas.

### 4. Verificación

Ejecutar localmente los mismos comandos que rompieron el CI:
- `bun run audit:arch` (script `scripts/audit-architecture.ts`) — 0 archivos > 200 líneas.
- `bun run audit:casts` — regenera `docs/cast-audit.md` con 0 HIGH / 0 CRITICAL.
- `bunx vitest run src/lib/__tests__/architecture.test.ts src/lib/__tests__/architecture-baseline.test.ts src/__tests__/audit-report.test.ts src/__tests__/audit-casts-classifier.test.ts` — 4 archivos verdes.
- `bun run test:fast` para confirmar que no se rompió nada de marketing/onboarding.
- `bun run build` como sanity final.

### 5. Housekeeping

- Bump `APP_VERSION` a `13.259.0` en `src/constants/appVersion.ts`.
- Entrada en `CHANGELOG.md` describiendo el fix de baselines (arquitectura + casts + longitud).

## Detalles técnicos

- No cambia comportamiento: la extracción es sólo reorganización de módulos. `getAttribution` conserva firma (`() => Attribution`) y semántica (silenciosa ante `sessionStorage` bloqueado o JSON inválido).
- El nuevo parser reemplaza `JSON.parse(raw) as Partial<Attribution>` por algo tipo:
  ```ts
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object") return EMPTY;
  const rec = parsed as Record<string, unknown>; // SAFE-CAST: narrowed above
  const pick = (k: string) => (typeof rec[k] === "string" ? (rec[k] as string) : null);
  ```
  El único `as` restante queda cubierto por el marcador `// SAFE-CAST:` (ver `mem://principles/safe-cast`) y baja severidad a SAFE en el clasificador.
- El helper de `Onboarding` sólo mueve lógica, no toca la RPC `complete_onboarding` ni el estado del formulario.
