## Optimizar `.github/workflows/ci.yml`

Cuatro mejoras concretas para acortar wall-time del CI sin reducir cobertura. Ahorro estimado: **~3-5 min por run** (depende del cache hit ratio).

---

### Cambios propuestos

**1. Eliminar la segunda compilación duplicada (`quality` job)**

Hoy: `Build` corre `vite build` (~60-90 s), luego `Bundle analyzer (informational)` corre `ANALYZE=true bun run build` (~60-90 s otra vez). Son **dos builds completas**. La 2ª sólo existe para emitir `dist/bundle-stats.html` vía `rollup-plugin-visualizer`.

Fix: una sola build con `ANALYZE=true` siempre activo. `visualizer` añade <100 ms; el HTML se sube como artifact con `if-no-files-found: ignore` para el caso de que el plugin se desactive.

**Ahorro: ~1-2 min por run.**

**2. Reducir shards de tests de 16 → 8**

16 shards en un repo de ~140 test files genera mucho overhead de spin-up + `bun install` por shard. Cada shard hoy paga ~25-45 s de checkout + install + arranque vitest antes de empezar. Con 8 shards:
- mismo paralelismo útil (la mayoría de runners free no permiten >20 jobs concurrentes igual),
- la mitad de minutos GitHub-runner facturados,
- merge de coverage más rápido (menos blobs).

Si algún shard se acerca al timeout de 20 min subimos a 10. Hoy los shards corren bajo 5 min según los logs subidos.

**Ahorro: ~40-60% en minutos facturados de la matriz.**

**3. Composite action para "setup + install"**

Hoy `Setup Bun` + `Cache Bun deps` + `Install dependencies` se repite **3 veces** (quality, tests, coverage). Mover a `.github/actions/setup-bun/action.yml` y referenciarlo con `uses: ./.github/actions/setup-bun`. Sin cambio funcional, sólo de mantenimiento (un solo lugar para bumpear `bun-version`, cambiar la clave de cache, etc.).

**Ahorro: 0 s wall-time, pero elimina drift entre jobs.**

**4. Saltar CI en cambios sólo-docs**

Añadir `paths-ignore` para archivos que no afectan build/tests:

```yaml
on:
  pull_request:
    paths-ignore: ["**/*.md", "docs/**", ".github/ISSUE_TEMPLATE/**", "CHANGELOG.md"]
  push:
    branches: [main]
    paths-ignore: ["**/*.md", "docs/**", "CHANGELOG.md"]
```

Importante: dejar `push: main` también con `paths-ignore` para no romper required checks si el commit toca solo el changelog.

**Ahorro: ~12 min cuando aplica (PR de solo docs).**

---

### Lo que NO toco (y por qué)

- **`quality` job lineal**: separar `lint/typecheck/audit` en jobs distintos paraleliza, pero cada uno pagaría ~30 s de install. El total acaba siendo similar y con más yaml.
- **`coverage` corre `bun install`**: necesita `tsx` para `coverage:report`, no se puede saltar.
- **Pinear actions a SHA**: gano seguridad pero no velocidad; lo dejo para otro ticket.
- **Cache de `dist/`** entre runs: poco beneficio porque `bun run build` se ejecuta una sola vez (post-fix #1) y los inputs cambian en cada commit.

---

### Archivos a tocar

- `.github/workflows/ci.yml` — los 4 cambios.
- `.github/actions/setup-bun/action.yml` — **nuevo** (composite action).
- `CHANGELOG.md` + `src/constants/appVersion.ts` — bump a `13.14.9`.

### Riesgos

- **`ANALYZE=true` siempre activo** podría romper si alguien remueve `rollup-plugin-visualizer` del `vite.config.ts`. El paso de upload tolera ausencia (`if-no-files-found: ignore`), no rompe el job.
- **Reducir a 8 shards** podría llevar un shard cerca del timeout si crece la suite. Timeout actual es 20 min, los logs muestran <5 min por shard hoy.
- **`paths-ignore`**: si el repo tiene un required check `Tests`/`Build` en branch protection, los PRs sólo-docs se quedan en "pending" y no pueden mergearse. Mitigación: si tienes branch protection, **no aplicar este punto** o usar el patrón "always-passing skip job" (lo aclaro en el commit).


---

## Estándar de Arquitectura Feature-First (Post-auditoría)

Aplicar a todo nuevo código y migrar gradualmente en refactors.

### 1. Estructura de directorios

```
src/
  features/           ← Dominio acotado (embarques, clientes, facturas, etc.)
    <dominio>/
      components/     ← UI exclusiva del dominio
      hooks/          ← Lógica de estado + efectos
      services/       ← API calls, Supabase, edge functions
      utils/          ← Helpers puros del dominio
      types/          ← Interfaces/ tipos del dominio
      constants/      ← Constantes del dominio
      index.ts        ← Barrel SIN lógica (sólo re-exports)
  components/         ← UI compartida (shadcn, layout genérico)
  hooks/              ← Hooks transversales (useAuth, useDebounce)
  services/           ← Clients base (supabase, axios)
  utils/              ← Utilidades puras transversales
  constants/          ← Constantes globales
  types/              ← Tipos globales
```

### 2. Reglas de ubicación

| Tipo de archivo | Ubicación obligatoria | Ejemplos |
|----------------|----------------------|----------|
| Componente de página | `src/pages/` o `src/features/<x>/pages/` | `Dashboard.tsx` |
| Componente reutilizable genérico | `src/components/` | `DataTable`, `Modal` |
| Componente de dominio | `src/features/<dominio>/components/` | `ShipmentTimeline` |
| Hook de dominio | `src/features/<dominio>/hooks/` | `useEmbarquesList` |
| Hook transversal | `src/hooks/` | `useDebounce`, `useLocalStorage` |
| Servicio de dominio | `src/features/<dominio>/services/` | `proforma.ts` |
| Servicio base/infra | `src/services/` | `supabase/client.ts` |
| Utilidad pura transversal | `src/utils/` | `dateCalculations.ts` |
| Utilidad de dominio | `src/features/<dominio>/utils/` | `diffFields.ts` |

### 3. Nomenclatura

- **Directorios**: kebab-case (`dashboard-ejecutivo`, `cliente-management`)
- **Componentes React**: PascalCase (`SidebarHeader.tsx`)
- **Hooks**: camelCase con prefijo `use` (`useAuth.ts`)
- **Servicios**: camelCase (`proforma.ts`, `proveedorFacturas.ts`)
- **Utilidades**: camelCase (`dateCalculations.ts`)
- **Tipos**: PascalCase (`ShipmentStatus.ts`)
- **Constantes**: UPPER_SNAKE_CASE en archivo, exportadas como camelCase si es objeto

### 4. Prohibiciones

- **NO** escribir lógica en `index.ts` (barrels) — sólo `export * from './file'`
- **NO** dejar archivos huérfanos fuera de `features/` que pertenezcan a un dominio
- **NO** duplicar queries de Supabase en múltiples servicios — centralizar en helpers
- **NO** usar `as unknown as` — usar type guards o zod

### 5. Métras de calidad (objetivos)

- Archivos ≤ 300 líneas (advertencia a 300, crítico a 500)
- Funciones ≤ 50 líneas
- Componentes: UI + hooks separados cuando excedan 150 líneas
- Cero `as unknown as` en código productivo
- Cero lógica en barrels

---

### Archivos a tocar

- `.github/workflows/ci.yml` — los 4 cambios.
- `.github/actions/setup-bun/action.yml` — **nuevo** (composite action).
- `CHANGELOG.md` + `src/constants/appVersion.ts` — bump a `13.14.9`.

### Riesgos

- **`ANALYZE=true` siempre activo** podría romper si alguien remueve `rollup-plugin-visualizer` del `vite.config.ts`. El paso de upload tolera ausencia (`if-no-files-found: ignore`), no rompe el job.
- **Reducir a 8 shards** podría llevar un shard cerca del timeout si crece la suite. Timeout actual es 20 min, los logs muestran <5 min por shard hoy.
- **`paths-ignore`**: si el repo tiene un required check `Tests`/`Build` en branch protection, los PRs sólo-docs se quedan en "pending" y no pueden mergearse. Mitigación: si tienes branch protection, **no aplicar este punto** o usar el patrón "always-passing skip job" (lo aclaro en el commit).

¿Aplicar los 4 puntos? ¿O sólo 1+2+3 (omitir `paths-ignore` por la duda de branch protection)?

