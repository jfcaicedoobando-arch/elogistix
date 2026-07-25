
# Plan: Reparar CI (logs 81765547800)

## Fallas detectadas (7 independientes)

1. **ESLint (max-warnings 0)** — `src/lib/tools/__tests__/audit-migrations.regex.test.ts:15` tiene un `// eslint-disable-next-line no-eval` que ya no aplica.
2. **audit:tests** — `duplicate-title`: el título `"retorna 0 cuando la RPC devuelve null"` existe en `cxpAprobacionCount.test.ts:23` y `cxpPorPagarCount.test.ts:26` (nacieron del mismo scaffold en S2b).
3. **Arch baseline `> 200 líneas`** — 5 archivos productivos rebasan el límite Power of 10:
   - `src/features/cxp/routes/Cxp.tsx` (244)
   - `src/features/tesoreria/routes/TesoreriaConciliacion.tsx` (241)
   - `src/features/bandejas/routes/CxpPorPagar.tsx` (240)
   - `src/features/anticipos-proveedor/routes/AnticiposProveedor.tsx` (237)
   - `src/features/compras/routes/ComprasReportes.tsx` (218)
4. **`no-hardcoded-tcs.test.ts`** — regex `/[*/+-]\s*20\b|\b20\s*[*/+-]/` es falso-positivo: pega contra clases Tailwind `border-primary/20`, `bg-muted/20`, `py-20`, etc. 9 archivos reportados, ninguno tiene un TC literal.
5. **`EstadoFacturaCxPCell.test.tsx`** — 2 tests fallan porque el componente usa `<Tooltip>` de Radix sin envolver en `TooltipProvider` dentro del `render`.
6. **`agregador.fuente.test.ts`** — 3 tests esperan `fetchEstadoResultadosDevengado/Mes` llamado 14 veces, pero tras P8 el agregador ahora hace 2 llamadas + 1 RPC `eerr_resumen_anual` (mismo cambio que ya arreglamos en `agregador.test.ts` en v13.317.7 — este archivo hermano se quedó atrás).
7. **Coverage** — reporta debajo de umbrales (35.55/38, 27.42/30, 34.89/38, 29.36/34). Es consecuencia directa de que los shards 3 y 4 abortaron; al pasar los tests el coverage se recupera. Sin bajar thresholds.

## Analogía

Piensa en CI como una torre de bloques: cuando dos bloques (los shards que fallaron) se caen, la torre entera no se sostiene aunque los demás estén bien. Vamos a poner cada bloque bien plantado — no vamos a cortar la torre.

## Cambios técnicos

### 1. ESLint
- Quitar la línea `// eslint-disable-next-line no-eval` innecesaria en `audit-migrations.regex.test.ts:15`.

### 2. Duplicate title
- Renombrar el test en `cxpPorPagarCount.test.ts` a `"retorna 0 cuando la RPC de por pagar devuelve null"` (o similar) para reflejar contexto.

### 3. Archivos > 200 líneas (extraer secciones, sin cambiar lógica)
Para cada uno, extraer 2–3 sub-componentes/hooks a archivos hermanos hasta bajar a ≤200 líneas. Foco en presentación:
- `Cxp.tsx` → extraer `CxpBandejaHeader.tsx` (título + tabs + acciones) y `CxpBandejaEmptyState.tsx`.
- `TesoreriaConciliacion.tsx` → extraer `ConciliacionFiltrosBar.tsx` y `ConciliacionResumenPanel.tsx`.
- `CxpPorPagar.tsx` → extraer `CxpPorPagarKpis.tsx` y `CxpPorPagarToolbar.tsx`.
- `AnticiposProveedor.tsx` → extraer `AnticiposProveedorTabla.tsx` (columns + render) y `AnticiposProveedorHeader.tsx`.
- `ComprasReportes.tsx` → extraer `ComprasReportesTarjetas.tsx`.

### 4. `no-hardcoded-tcs.test.ts` (arreglar la regla, no los archivos)
Refinar el patrón para que sólo detecte multiplicaciones/divisiones numéricas de TC — NO clases de Tailwind:
- Excluir matches dentro de strings entre comillas (`"..."`, `'...'`, `` `...` `` sin interpolación numérica) porque `border-primary/20`, `bg-muted/20`, `py-20`, `w-20` viven en `className`.
- Nuevo enfoque: recorrer líneas, saltar líneas con `className=` / `class=` / dentro de `cn(...)`, luego buscar `[a-zA-Z_$)\]]\s*[*/]\s*20\b` o `\b20\s*[*/]\s*[a-zA-Z_$(]` (i.e. TC contra identificador).
- Agregar 1 test unitario dedicado a la regex con casos positivos/negativos para prevenir regresiones.

### 5. `EstadoFacturaCxPCell.test.tsx`
Envolver el `render` con `<TooltipProvider>` (o crear un helper `renderWithTooltipProvider`). Sin tocar el componente productivo.

### 6. `agregador.fuente.test.ts`
Ajustar las 3 aserciones al nuevo contrato P8:
- `con fuente='facturas'`: `fetchEstadoResultadosDevengado` llamado `2` veces + `supabase.rpc('eerr_resumen_anual')` `2` veces (mockear como en `agregador.test.ts`).
- `con fuente='embarques'`: `fetchEstadoResultadosMes` llamado `2` veces + `supabase.rpc('eerr_resumen_anual')` `2` veces.
- `sin fuente explícita`: sigue por default `embarques`; misma cuenta.
- Renombrar títulos: `... (14 veces)` → `... (mensual + anual)`.

### 7. Coverage
No tocar `vitest.config.ts`. Al pasar los shards, el merge de blobs incluye los archivos que hoy no reportan y el % sube.

## Cierre

- Bump `APP_VERSION` a `13.317.9`.
- Entrada en `CHANGELOG.md`:
  ```
  ## [13.317.9] - 2026-07-25
  - Fix CI: ESLint (unused disable), audit:tests (dup title), arch >200 líneas (5 rutas divididas), no-hardcoded-tcs regex refinada, TooltipProvider en test CxP, agregador.fuente alineado a P8.
  ```
- Verificación local: `bun run lint -- --max-warnings 0`, `bun run audit:tests`, y vitest sobre los 3 archivos tocados de test.
