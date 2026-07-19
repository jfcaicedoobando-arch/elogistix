## Verificación Ola 2 (v13.302.2)

- Lint 0 warnings y `vitest` 8/8 verdes tras cerrar la ola anterior.
- `features/embarques/components/pnl/KpiCard.tsx` eliminado; sus 2 consumidores (`TabPnl`, `TablaPnlPorMoneda`) apuntan al canónico `@/components/shared/KpiCard` con el mapeo `tone → variant`.
- Test de regresión en `primitives.test.tsx` cubre `PageContainer width="wide"`.
- Sin bugs abiertos ni tests faltantes para esta ola.

## Sprint 2 · Ola 3 — Consolidar `features/operaciones/components/KpiCard.tsx`

Este clon lo usan **5 consumidores** (`Operaciones`, `Cotizaciones`, `AdminOrgDetalle`, `ReportesKpiCards`, `ClienteSummaryCards`) y tiene 3 features que el canónico no soporta hoy: tooltip sobre el valor, slot de `children`, icono con chip tintado y tipografía adaptativa hasta `text-3xl`. Migrar 1:1 perdería pulido visual (Operaciones muestra "USD 1.2M" con tooltip completo, y "20 / 25 TEU" con children), así que primero enriquezco el canónico y luego migro.

### Paso 1 — Enriquecer `@/components/shared/KpiCard`
Aditivos, sin romper la API actual:
- `valueTooltip?: string` — se aplica al `title` del `<p>` de valor.
- `children?: React.ReactNode` — se renderiza debajo del sublabel dentro del `CardContent`.
- `iconVariant?: "inline" | "chip"` (default `inline` = comportamiento actual). En `chip` renderiza el icono en un div tintado a la izquierda usando `kpiIconChipClasses(tone)` de `@/lib/ui/kpiTones`, con `tone` derivado del `variant` (`info→info`, `success→success`, `warning→warning`, `destructive→danger`, `default→neutral`, más alias `accent`).
- Ampliar `KpiVariant` con `"accent"` (violeta) para cubrir el color del clon.
- Escalones de `valueSize` amplían a `text-3xl` cuando `iconVariant="chip"` y el valor es ≤8 chars (paridad con el clon de operaciones).

### Paso 2 — Migrar los 5 consumidores
Mapping común: `titulo→label`, `valor→value`, `valorTooltip→valueTooltip`, `subtitulo→sublabel`, `icono→icon`, `children→children`. Tabla de tonos:

```text
blue    → info
violet  → accent
emerald → success
red     → destructive
info    → info
accent  → accent
success → success
danger  → destructive
```

Los 5 consumidores usan `iconVariant="chip"` para conservar el look actual.

### Paso 3 — Borrar el clon
Eliminar `src/features/operaciones/components/KpiCard.tsx` y verificar con `rg` que no queda ningún import.

### Paso 4 — Tests y CI
- Extender `src/components/shared/__tests__/KpiCard.test.tsx` con casos: `iconVariant="chip"` renderiza el icono, `valueTooltip` se refleja en `title`, `children` se renderiza, y `variant="accent"` aplica clases correspondientes.
- Correr `bun run lint -- --max-warnings 0` y `bun run test`.

### Paso 5 — Versionado
- Bump `APP_VERSION` a `13.302.3`.
- Entrada en `CHANGELOG.md` describiendo la consolidación y el enriquecimiento de la API (no-breaking).

## Detalles técnicos (por si interesa)

- `KpiCard` canónico añade dos props opcionales + un `iconVariant` opcional; los ~9 consumidores existentes no cambian de comportamiento porque los defaults preservan la variante `inline`.
- El `variant="accent"` se agrega a `variantStyles`/`iconStyles` con tokens semánticos ya definidos (`--accent`, `text-accent-foreground`) para no introducir literales.
- Riesgo: si algún consumidor del canónico depende del tamaño exacto (`text-2xl`), no cambia porque `text-3xl` sólo aplica cuando `iconVariant="chip"`.

## Fuera de alcance de esta ola
- Migrar los ~7 clones restantes (`KpiTile`, mini-tarjetas de Dashboard, tarjetas de Facturación) — se abordan en la Ola 4 tras validar visualmente Ola 3.
