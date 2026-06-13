# Plan: Migración folder-style de dominios restantes

Cierra la última deuda estructural pendiente tras la auditoría arquitectónica (v12.95.x): consolidar cada dominio bajo `src/features/<dominio>/` siguiendo el patrón ya aplicado a `crm` y `embarques`.

## Patrón objetivo (por dominio)

```text
src/features/<dominio>/
  components/      ← desde src/components/<dominio>/ y src/pages/<dominio>/*Card,*Table,*Dialog
  hooks/           ← desde src/hooks/<dominio>/
  services/        ← desde src/services/<dominio>/ (mantener subcarpetas queries/mutations)
  domain/          ← lógica pura (helpers, validators, builders) si existe en lib/domain o lib/<dominio>
  types/           ← desde src/types/<dominio>*
  queryKeys.ts     ← ya migrado en v12.95.23
  index.ts         ← barrel público del feature
```

Las páginas (`src/pages/<dominio>/*.tsx`) **permanecen** en su ubicación actual (son rutas), pero consumen del feature vía `@/features/<dominio>`.

## Orden de ejecución (riesgo creciente)

### Fase 1 — `proveedor` (~20 archivos, bajo riesgo)
- Mover `src/hooks/proveedor/`, `src/services/proveedor/`, `src/components/proveedor/*` (si existen) y `src/types/proveedor*` → `src/features/proveedor/`.
- Crear barrel `index.ts`.
- Actualizar imports con `rg`/codemod.
- Bump versión, changelog.

### Fase 2 — `cliente` (~25 archivos)
- Mover `src/hooks/cliente/`, `src/services/cliente/`, `src/types/cliente*.ts`, `src/types/clienteForm.ts`.
- Mover `lib/domain/cliente` si aplica.
- Páginas en `src/pages/clientes/` quedan; ajustar imports.

### Fase 3 — `cxp` (~15 archivos)
- Incluye `src/components/cxp/` (recién fragmentado: `PagoProveedorFormBody`, `usePagoProveedorForm`, `DialogRegistrarPagoProveedor`).
- Mover `src/hooks/cxp/`, `src/services/cxp/`.

### Fase 4 — `tesoreria` (~10 archivos)
- Mover `src/hooks/tesoreria/`, `src/services/tesoreria/` (cuentas, conciliacion, resumen, flujoProyectado).
- Página `src/pages/tesoreria/TesoreriaFlujo.tsx` queda.

### Fase 5 — `cotizacion` (~50 archivos, alto impacto)
- Mover `src/hooks/cotizacion/` (incluye `wizard/`, `mutations/`), `src/services/cotizacion/`, `src/types/cotizacion/` (ya en folder), `lib/domain/cotizacion`.
- Validar tests `src/pdf/documents/__tests__/CotizacionDocument.test.tsx` y `src/generators/cotizacion/__tests__/*`.
- Migrar en 2 sub-pasos: (5a) hooks + services, (5b) types + domain.

### Fase 6 — `facturas` + `facturacion` (~40 archivos, alto impacto)
- Unificar bajo `src/features/facturas/` (mantener `facturacion` como subcarpeta si conviene).
- Mover `src/hooks/facturacion/`, `src/services/facturacion/` (si existe), generators relacionados quedan en `src/generators/`.

### Fase 7 — `portal` (~15 archivos)
- Mover `src/hooks/portal/`, `src/services/portal/`, componentes `src/pages/portal/*` auxiliares (no las rutas).

## Reglas operativas (por fase)

1. **Una fase = una versión** (`12.96.0`, `12.96.1`, …) con entrada en `CHANGELOG.md`.
2. **Sin cambios de comportamiento**: solo mover + actualizar imports. Cero lógica modificada.
3. **Imports**: actualizar con `rg -l "from ['\"]@/(hooks|services|types)/<dominio>" | xargs sed -i …` y verificar build.
4. **Compatibilidad temporal**: si un import externo es masivo, dejar archivo `barrel` re-exportando desde la ruta vieja por 1 versión, marcado `@deprecated`.
5. **Tests**: correr `bun run audit:arch` + suite de tests del dominio tras cada fase. Una fase no se cierra hasta que verde.
6. **Power of 10**: respetar ≤200 LOC por archivo movido; si excede, fragmentar dentro de la misma fase.
7. **No tocar** `src/integrations/supabase/client.ts` ni `src/lib/query/index.ts` (solo agregar imports).

## Entregable por fase

- Commit con archivos movidos y imports ajustados.
- `APP_VERSION` bumpeado.
- Entrada `CHANGELOG.md` formato `## [X.Y.Z] - YYYY-MM-DD`.
- `bun run audit:arch` 0 errores.
- `.lovable/plan.md` actualizado marcando fase como ✅.

## Fuera de alcance

- Rediseño de UI o lógica.
- Migración de `lib/facturacion/`, `lib/operaciones/`, `lib/financial/profitUtils.ts` (ya diferidos en plan original).
- Crear nuevos endpoints o RLS.

## Detalles técnicos

- Codemod sugerido: `node scripts/codemod-feature-move.mjs <dominio>` (a crear en Fase 1, reutilizable).
- Verificación previa por fase: `rg "from ['\"]@/(hooks|services|types)/<dominio>" src --count-matches` para dimensionar blast radius.
- Si un dominio comparte archivos con otro (ej. `cxp` ↔ `facturas`), el archivo va al feature que lo "posee" semánticamente y el otro lo importa vía `@/features/…`.

## Estimación

| Fase | Dominio | Archivos | Esfuerzo |
| ---- | ------- | -------- | -------- |
| 1 | proveedor | ~20 | 30 min |
| 2 | cliente | ~25 | 45 min |
| 3 | cxp | ~15 | 30 min |
| 4 | tesoreria | ~10 | 20 min |
| 5 | cotizacion | ~50 | 90 min |
| 6 | facturas/facturacion | ~40 | 75 min |
| 7 | portal | ~15 | 30 min |

Total: ~5 horas distribuidas en 7 versiones incrementales.
