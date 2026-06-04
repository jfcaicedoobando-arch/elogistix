# Plan: Migrar Auditoría a `src/features/auditoria/`

## Objetivo
Consolidar todo el stack vertical del dominio **Auditoría operativa** en una sola carpeta auto-contenida, replicando el patrón ya usado en `src/features/embarques/`. Mantener URLs y comportamiento intactos — sólo reorganización + reescritura de imports.

## Inventario actual (qué se mueve)

```text
src/pages/Auditoria.tsx
src/hooks/auditoria/**                  (16 archivos + revisiones/ + __tests__/)
src/services/auditoria/**               (5 servicios + index + __tests__)
src/lib/auditoria/ejecutivoAgregados.ts (+ test)
src/lib/domain/auditoria.ts             (+ test)
src/lib/domain/auditoriaCsv.ts          (+ test)
src/lib/domain/auditoriaReglaLabels.ts
src/constants/auditoria.ts
src/types/auditoria.ts
src/components/auditoria/**             (15 componentes + asignarResponsable/, ejecutivo/, marcarRevisado/, __tests__)
```

Tablas de hooks / routing afectadas:
- `src/routes/appRoutes.tsx` (línea 12, 147)
- `src/routes/appRoutes.lazy.ts` (línea 15)
- `src/components/shared/utils/auditoriaConfig.ts`
- `src/hooks/layout/useAppSidebarSections.ts`

## Estructura destino

```text
src/features/auditoria/
├── components/
│   ├── HallazgoTabla.tsx
│   ├── HallazgosTabla.tsx
│   ├── HallazgosTablaPaginada.tsx
│   ├── HallazgosFiltros.tsx
│   ├── MarcarRevisadoDialog.tsx
│   ├── AsignarResponsableDialog.tsx
│   ├── AuditoriaHallazgosTab.tsx
│   ├── AuditoriaEjecutivoTab.tsx
│   ├── AuditoriaPorReglaTab.tsx
│   ├── AuditoriaOperadoresCard.tsx
│   ├── AuditoriaRiesgoFinancieroCard.tsx
│   ├── AuditoriaTendenciaChart.tsx
│   ├── hallazgosTablaConfig.ts
│   ├── asignarResponsable/
│   ├── ejecutivo/
│   ├── marcarRevisado/
│   └── __tests__/
├── constants/
│   └── index.ts            ← desde src/constants/auditoria.ts
├── domain/
│   ├── reglaLabels.ts      ← desde lib/domain/auditoriaReglaLabels.ts
│   ├── csv.ts              ← desde lib/domain/auditoriaCsv.ts
│   ├── core.ts             ← desde lib/domain/auditoria.ts
│   ├── ejecutivoAgregados.ts ← desde lib/auditoria/
│   └── __tests__/
├── hooks/
│   ├── index.ts
│   ├── useAuditoria.ts
│   ├── useAuditoriaPageController.ts
│   ├── useAuditoriaEjecutivo.ts
│   ├── useAuditoriaSnapshots.ts
│   ├── useAuditoriaComentarios.ts
│   ├── useAuditoriaRevisiones.ts
│   ├── useAsignarResponsableController.ts
│   ├── useMarcarRevisadoController.ts
│   ├── useHallazgosTablaState.ts
│   ├── useOrgMembersAsignables.ts
│   ├── useSnoozeHallazgo.ts
│   ├── hallazgosTablaFilters.ts
│   ├── revisiones/ (query, marcar, desmarcar, asignar, hash)
│   └── __tests__/
├── routes/
│   └── AuditoriaPage.tsx    ← desde src/pages/Auditoria.tsx
├── services/
│   ├── index.ts
│   ├── comentarios.ts
│   ├── reporte.ts
│   ├── revisiones.ts
│   ├── snapshots.ts
│   ├── snooze.ts
│   └── __tests__/
├── types/
│   └── index.ts            ← desde src/types/auditoria.ts
└── index.ts                ← barrel público (página + hooks/servicios usados afuera)
```

## Reescritura de imports (mapa)

| Antes | Después |
|---|---|
| `@/pages/Auditoria` | `@/features/auditoria/routes/AuditoriaPage` |
| `@/hooks/auditoria/*` | `@/features/auditoria/hooks/*` |
| `@/services/auditoria/*` | `@/features/auditoria/services/*` |
| `@/lib/auditoria/ejecutivoAgregados` | `@/features/auditoria/domain/ejecutivoAgregados` |
| `@/lib/domain/auditoria` | `@/features/auditoria/domain/core` |
| `@/lib/domain/auditoriaCsv` | `@/features/auditoria/domain/csv` |
| `@/lib/domain/auditoriaReglaLabels` | `@/features/auditoria/domain/reglaLabels` |
| `@/constants/auditoria` | `@/features/auditoria/constants` |
| `@/types/auditoria` | `@/features/auditoria/types` |
| `@/components/auditoria/*` | `@/features/auditoria/components/*` |

Archivos a tocar fuera del feature:
- `src/routes/appRoutes.lazy.ts` → `lazy(() => import("@/features/auditoria/routes/AuditoriaPage"))`
- `src/routes/appRoutes.tsx` → sin cambios (sigue usando símbolo `Auditoria`)
- `src/components/shared/utils/auditoriaConfig.ts` → reapuntar imports de `@/lib/domain/auditoria*`
- `src/hooks/layout/useAppSidebarSections.ts` → reapuntar si referencia constants/types

## Pasos de ejecución (paralelizables por subagentes)

1. **S1 – Move físico**: `git mv` (vía `mv`) de los 6 grupos (pages, hooks, services, lib, constants, types, components) a `src/features/auditoria/` respetando subcarpetas y tests. Renombrar `Auditoria.tsx` → `routes/AuditoriaPage.tsx`. Renombrar archivos de `lib/domain/auditoria*` a `domain/{core,csv,reglaLabels}.ts`.
2. **S2 – Imports internos**: dentro de `src/features/auditoria/**` corregir rutas relativas/alias entre componentes, hooks, services, domain, types.
3. **S3 – Imports externos**: aplicar el mapa de reescritura en los ~6 archivos consumidores fuera del feature (`appRoutes.lazy.ts`, `auditoriaConfig.ts`, `useAppSidebarSections.ts`, tests en `hooks/layout/__tests__`).
4. **S4 – Barrel `index.ts`** con la superficie pública mínima.
5. **S5 – Verificación**: `bun run typecheck`, `bun run test`, scan `rg "hooks/auditoria|services/auditoria|lib/(auditoria|domain/auditoria)|pages/Auditoria|components/auditoria|constants/auditoria|types/auditoria" src` debe regresar 0 hits.
6. **S6 – CHANGELOG + APP_VERSION** → `12.58.0` con entrada describiendo el vertical slice.

## Detalles técnicos
- No se cambian URLs, lazy boundaries, query keys, ni firmas públicas.
- Los `__tests__` se mueven junto con el código probado (mantienen colocación).
- Mocks `vi.mock("@/services/auditoria/...")` en tests se reapuntan al nuevo path.
- `src/lib/domain/auditoria*` se elimina; se valida que ningún otro dominio los importe (grep confirmó: solo Auditoría los usa).
- Respeta Power of 10 (sin tocar tamaños de componentes; solo move + imports).

## Riesgos
- Casing: macOS/Linux. Usar `git mv` (vía `mv`) explícito para preservar historia.
- Pueden quedar imports rotos en tests si un mock path está hardcodeado — el grep final de S5 lo detecta.

## Entregable
PR con ~60-70 archivos movidos, ~10 archivos editados fuera del feature, build + tests verdes, `APP_VERSION = 12.58.0`, entrada en `CHANGELOG.md`.
