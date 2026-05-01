# Auditoría de arquitectura — Libre Carga

Análisis read-only del repositorio. La buena noticia: la arquitectura documentada en `ARCHITECTURE.md` está **mayormente respetada**. No hay violaciones graves de capa (pages/components nunca llaman Supabase directo). Lo que sigue son inconsistencias reales y mejoras de mantenibilidad.

## Resumen de salud

| Área | Estado |
|---|---|
| Pages → Supabase directo | OK (0 violaciones) |
| Components → Supabase directo | OK (0 violaciones) |
| `lib/` puro (sin Supabase) | OK |
| Services con React Query | OK (0 violaciones) |
| Convención folder-barrel en `services/` | **Inconsistente** (7 archivos sueltos) |
| Hooks → Services | **Inconsistente** (3 hooks llaman Supabase directo) |
| Tamaño de archivos | 1 componente excede umbral razonable |
| Naming bilingüe | Consistente con §7 |

---

## Hallazgos priorizados

### 1. [CRÍTICO-org] 7 services sueltos que violan la convención folder-barrel

`ARCHITECTURE.md §4` y la decisión v8.86.0 dicen: cada dominio es una carpeta con `index.ts`. Quedaron 7 archivos sueltos en `src/services/`:

```text
src/services/
├── clientUserService.ts        ← debería ser services/cliente-usuarios/index.ts
├── clienteFinancialsService.ts ← debería fusionarse a services/cliente/financials.ts
├── operacionesService.ts       ← services/operaciones/index.ts
├── planesService.ts            ← services/planes/index.ts (o admin/planes.ts)
├── proveedorServices.ts        ← services/proveedor/{crud,...}.ts (typo: "Services" plural)
├── reportesService.ts          ← services/reportes/index.ts
└── trackingService.ts          ← services/tracking/index.ts
```

El typo `proveedorServices.ts` (plural + sufijo) contradice explícitamente §7 ("Naming services: verbo en infinitivo, sin sufijo `Service`").

**Impacto:** confusión para nuevos colaboradores, imports inconsistentes (`@/services/trackingService` vs `@/services/cliente`), y rompe la regla declarada en el propio ARCHITECTURE.md.

### 2. [CRÍTICO-capa] 3 hooks llaman Supabase directo en lugar de pasar por services

```text
src/hooks/auditoria/useAuditoriaRevisiones.ts  → supabase.from/auth/insert
src/hooks/auditoria/useAuditoria.ts            → supabase.rpc("auditoria_embarques_org")
src/hooks/embarque/useEmbarqueFullQuery.ts     → supabase.rpc("get_embarque_full")
```

Esto contradice §3.2 ("un service expone funciones async; un hook envuelve services con cache"). Además mezcla en un mismo `useMutation` la inserción principal **y** la escritura en `bitacora_actividad` (acoplamiento de dos dominios).

`useAuditoriaRevisiones.ts` (180 líneas) debería:
- extraer `fetchRevisiones / upsertRevision / deleteRevision` → `services/auditoria/revisiones.ts`
- delegar la entrada de bitácora al service ya existente `services/bitacora`
- el hook queda solo con orquestación de cache + toast

### 3. [ALTO] `HallazgosTablaPaginada.tsx` (527 líneas) mezcla 4 responsabilidades

Es el segundo archivo más grande del proyecto detrás del shadcn `sidebar.tsx`. Concentra: filtros (búsqueda, severidad, regla, rango de fechas), paginación, render de tabla, y trigger del diálogo de revisado. Tiene 13 `useState/useMemo`.

**Recomendación de partición:**
```text
components/auditoria/
├── HallazgosTabla.tsx              (solo tabla + render)
├── HallazgosFiltros.tsx            (UI de filtros — patrón ya usado en EmbarquesFiltros)
├── HallazgosPagination.tsx         (controles)
└── hooks/useHallazgosTablaState.ts (filtros + paginación + memoizaciones)
```

### 4. [ALTO] Inconsistencia: 35 pages, 16 controllers (§3.5)

§3.5 manda extraer controller cuando una page tiene >5 hooks/handlers. Pages densas que probablemente lo necesiten (>180 líneas y sin controller asociado):

- `src/pages/Auditoria.tsx` (300 líneas, 10 useState/useMemo) — sin controller
- `src/pages/cotizaciones/Cotizaciones.tsx` (292) — verificar
- `src/pages/portal/PortalEmbarqueDetalle.tsx` (230)
- `src/pages/proveedores/ProveedorDetalle.tsx` (208)

**Acción:** auditar estas 4 pages y extraer `use<Page>PageController` donde corresponda. El patrón ya está bien establecido (`useReportesPageController`, `useClienteDetalleController`).

### 5. [MEDIO] `useAuthProfile.ts` mezcla acceso a datos con caching custom

`src/contexts/auth/useAuthProfile.ts` llama `supabase.rpc("get_user_context")` directamente (línea 54). Aunque AuthContext está marcado como excepción razonable, podría unificarse moviendo la llamada a `services/auth/index.ts` (que ya existe y solo expone `signInWithEmail`). Ganancia: un único punto de contacto con `auth` en services.

### 6. [MEDIO] Duplicación conceptual de "TabFacturacion"

`find` reporta dos archivos `TabFacturacion.tsx`. Verificar si comparten lógica (probablemente uno en `embarque/` y otro en `cliente/` o `proveedor/`). Si sí, extraer a `components/shared/` o a un hook común.

### 7. [MEDIO] `src/services/auth/` está casi vacío

Solo expone `signInWithEmail` + `resolveLandingRoute`. `resolveLandingRoute` es **lógica de routing pura** (no toca Supabase) — debería vivir en `src/lib/domain/auth.ts` o `src/lib/routing.ts`, no en services. Mantener services para acceso a datos como dice §3.2.

### 8. [BAJO] Hook `useAuditoria` retorna tipos definidos en sí mismo, importados por componentes

`HallazgosTablaPaginada.tsx` y `Auditoria.tsx` importan `HallazgoAuditoria, ReglaAuditoria, SeveridadAuditoria` desde `@/hooks/auditoria/useAuditoria`. §7 dice: tipos compartidos viven en `src/types/`. Mover a `src/types/auditoria.ts`.

### 9. [BAJO] `src/hooks/use-toast.ts` y `use-mobile.tsx` en raíz de hooks/

Son shadcn read-only (correcto), pero el resto de `hooks/` usa subcarpetas por dominio. Considerar `src/hooks/_shadcn/` para evidenciar que son intocables (decisión cosmética).

### 10. [BAJO] `src/services/__tests__/` contiene tests de servicios que ya no existen como archivo

Los tests `csfService.test.ts` y `trackingService.test.ts` siguen el naming `xService` que §7 rechaza. Renombrar conforme se reorganicen los services del punto 1.

---

## Cosas que están BIEN (no tocar)

- Pages no tocan Supabase: 0 violaciones encontradas.
- Components no tocan Supabase: 0 violaciones.
- `src/lib/` totalmente puro respecto a Supabase.
- Estructura de barrels en hooks/cotizacion, hooks/embarque correcta.
- AuthContext modular bien dividido (§12).
- Lazy-loading de jsPDF y rutas implementado.
- Cobertura de tests razonable en `lib/` y hooks de orquestación compleja.

---

## Plan de acción ordenado

| # | Acción | Esfuerzo | Riesgo | Beneficio |
|---|---|---|---|---|
| 1 | Migrar 7 services sueltos a folder-barrel + renombrar `proveedorServices` → `proveedor/` | M | Bajo (solo imports) | Alto — alinea con §4 |
| 2 | Extraer Supabase de `useAuditoriaRevisiones`, `useAuditoria`, `useEmbarqueFullQuery` a services | M | Bajo | Alto — cumple §3.2 |
| 3 | Partir `HallazgosTablaPaginada.tsx` (527 LOC) en 3-4 archivos + hook de estado | M | Medio (refactor UI) | Alto — testabilidad |
| 4 | Crear controllers para `Auditoria.tsx` y otras 3 pages densas | M | Bajo | Medio — coherencia §3.5 |
| 5 | Mover `resolveLandingRoute` de `services/auth/` a `lib/` | S | Bajo | Bajo — corrige capa |
| 6 | Mover tipos de `useAuditoria` a `src/types/auditoria.ts` | S | Bajo | Bajo |
| 7 | Verificar y consolidar duplicado `TabFacturacion.tsx` | S | Medio | Medio |
| 8 | (Opcional) Centralizar `useAuthProfile` Supabase call en `services/auth` | S | Bajo | Bajo |
| 9 | (Opcional) Renombrar tests `xService.test.ts` al nuevo naming | S | Nulo | Bajo |
| 10 | (Opcional) Mover hooks shadcn a `src/hooks/_shadcn/` | S | Bajo | Cosmético |

**Recomendación de orden de ejecución:** abordar 1 → 2 → 3 → 4 como bloque "alineación de arquitectura". Los puntos 5-10 pueden hacerse oportunísticamente.

Aprueba este plan para que en modo build empiece por el paso 1 (o indícame por cuál prefieres comenzar).
