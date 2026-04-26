# Auditoría de arquitectura

## Estado general

La arquitectura está **sana**. Hallazgos positivos:

- **Cero** imports directos de Supabase desde `src/components/` o `src/pages/` — la separación UI ↔ datos está bien respetada (todo pasa por `src/services/` o `src/hooks/`).
- `src/services/` ya migró casi por completo al patrón `folder/barrel` (cliente, cotizacion, embarque, proforma, admin, auth, csf, dashboard, etc.).
- `src/hooks/` está bien agrupado por dominio (catalogos, configuracion, cliente, cotizacion, embarque, facturacion, portal, proveedor, dashboard, admin, reportes).
- 206/206 tests pasando, build TS limpio.
- El componente más grande de la app (excluyendo `ui/sidebar.tsx` de shadcn) son **227 LOC** (`PortalEmbarqueDetalle`), por debajo del umbral de problema.

No hay deuda arquitectónica grave. Las 5 mejoras siguientes son **higiene táctica** ejecutables en un solo paso, ordenadas de más a menos impacto.

---

## 5 mejoras (ejecutables en 1 paso)

### 1. Eliminar shims muertos y consolidar imports (CRÍTICO higiene)

Tras las migraciones recientes quedan **28 archivos shim** (1-2 líneas que solo re-exportan). Trece de ellos tienen ≤2 importadores. Conservarlos confunde a la AI y a desarrolladores nuevos sobre cuál es la ubicación canónica.

Acción:
- Borrar shims con **0 importadores**: `src/lib/ui/wizardFeedback.ts`.
- Reapuntar los importadores de los 27 shims restantes (`src/hooks/use*.ts` y `src/services/*Service.ts` re-exports) a la ubicación canónica vía `rg` + reemplazo, y borrar los shims.
- Total: ~28 archivos eliminados, ~70 imports actualizados en el resto del código.

### 2. Partir `src/content/changelog/v8.ts` (774 LOC) por minor

`v8.ts` ya pesa más que `v4.ts` y crece cada release. El módulo se carga lazy pero al expandirse v9, v10… el patrón será insostenible.

Acción:
- Dividir `v8.ts` en `v8/` con un archivo por bloque de minor (`v8.0.ts`, `v8.50.ts`, `v8.90.ts`, `v8.97.ts`) e `index.ts` que concatena.
- Aplicar el mismo split a `v4.ts` (690 LOC).
- Sin cambios funcionales: el array final es idéntico.

### 3. Extraer 2 controllers pendientes (`PortalEmbarques`, `Operaciones`)

Son los únicos pages con ≥4 hooks y ≥150 LOC sin controller dedicado, rompiendo el patrón aplicado al resto de pages en v8.90-v8.92.

Acción:
- Crear `src/hooks/portal/usePortalEmbarquesController.ts` y `src/hooks/operaciones/useOperacionesPageController.ts`.
- Mover estado, queries, filtros y handlers; el page queda como UI + columnas.

### 4. Eliminar duplicación `SeccionCostosInternosPL{Detalle,Local,Unificado}.tsx`

Tres componentes con nombres casi idénticos en `src/components/cotizacion/`. `Unificado` ya existe; `Detalle` y `Local` son anteriores.

Acción:
- Verificar importadores de `Detalle` y `Local`; si `Unificado` cubre ambos casos, borrar los dos antiguos y reapuntar imports. Si difieren funcionalmente, renombrar para que la diferencia quede explícita en el nombre.

### 5. Promover `src/components/shared/` a su ubicación final y borrar la carpeta

`src/components/shared/` solo contiene 2 archivos: `ProfitBadge.tsx` (shim de re-export → `components/ProfitBadge.tsx`) y `ValidationAlert.tsx`. La carpeta `shared/` quedó marcada para eliminación en v8.91.0 y nunca se cerró.

Acción:
- Mover `ValidationAlert.tsx` a `src/components/ValidationAlert.tsx` (o `src/components/feedback/`).
- Borrar `src/components/shared/ProfitBadge.tsx` (shim) y reapuntar sus 5 importadores.
- Borrar la carpeta `shared/`.

---

## Detalle técnico

- **Verificación**: tras los 5 cambios correr `bunx tsc --noEmit` y `bunx vitest run` (objetivo: 206/206 verde).
- **Sin cambios de comportamiento**: las 5 mejoras son refactor estructural puro — no tocan lógica de negocio, queries, RLS ni UI visible.
- **Changelog**: una sola entrada `v8.98.0` (minor) describiendo la limpieza arquitectónica.

## Lo que NO se incluye (descartado tras revisión)

- Partir `CotizacionWizardLayout.tsx` (222 LOC): es composición declarativa, ya está bien.
- Mover toasts de `TabTracking` a un controller: solo tiene 4 useState locales del form, no justifica el overhead.
- Tocar `src/integrations/supabase/types.ts` (2111 LOC): autogenerado, prohibido.
- Reorganizar `src/lib/`: ya tiene la estructura por capa correcta (domain, financial, formatters, mappers, parsers, ui, errors, query, storage, contacto).
