# Sprint DRY · Consolidación de hooks de datos (Supabase)

**Alcance acordado:** solo capa de datos — se extraen custom hooks para lógica de fetching/mutación/realtime repetida en Supabase. No se tocan componentes UI ni utils salvo que sean bloqueantes para el hook.
**Riesgo acordado:** balanceado — cada hook reemplaza al código viejo en el **mismo commit**, con typecheck (`tsgo`) + tests unitarios del hook + smoke Playwright de la ruta afectada.

---

## Fase 0 · Auditoría DRY (en curso)

Un subagente `explore` está barriendo `src/features/**` con `rg` para localizar patrones repetidos ≥3 veces en la capa de datos. El resultado se anexa como `docs/refactor/dry-hooks-audit.md` antes de tocar código y define los hooks concretos a extraer. La lista de abajo es la **plantilla esperada** basada en patrones ya visibles; se ajustará con el reporte del subagente.

Hooks candidatos previstos (ordenados por impacto):

| # | Hook propuesto | Reemplaza patrón repetido en | Prioridad |
|---|---|---|---|
| 1 | `useSupabaseList<T>` | Listados paginados server-side (`.range()` + filtros + debounce) en `/embarques`, `/cotizaciones`, `/proformas`, `/facturas`, `/cxp`, `/compras/proveedor-facturas`, `/costeo/tarifas` | CRITICAL |
| 2 | `useSupabaseRealtime` | Suscripciones a channels + cleanup (`removeChannel`) — hoy repartido en dashboard, alertas, notificaciones, tracking | HIGH |
| 3 | `useEntityById<T>` | Fetch de detalle por `id` con `maybeSingle()` + loading/error/not-found — usado en detalles de embarque, factura, cotización, proforma, cliente, proveedor | HIGH |
| 4 | `useOrgScopedMutation` | INSERT/UPDATE con `organization_id` + `bitacora_actividad` + toast + invalidación de query — patrón repetido en clientes, proveedores, agentes, navieras, puertos | HIGH |
| 5 | `useSoftDelete` | Confirm "ELIMINAR" typable → update `deleted_at` / hard delete + log — hoy duplicado en 6-8 módulos | MED |
| 6 | `useDebouncedFilter` | Filtro con debounce 300 ms + sincronización con URL query params | MED |
| 7 | `useFileDownload` | Descarga de blob desde storage con manejo de errores/toast — hoy inline en documentos y facturas | LOW |

> El subagente confirma cuáles hooks tienen ≥3 sitios reales antes de crearse. Hooks con <3 usos se descartan (regla YAGNI).

---

## Fase 1 · Preparación (1 versión)

1. Anexar `docs/refactor/dry-hooks-audit.md` con hallazgos file:line del subagente.
2. Crear estructura `src/hooks/data/` con `index.ts` de barrel.
3. Agregar sección al plan maestro `.lovable/plan.md`.

**Bump:** `patch` (docs only).

## Fase 2 · Hook por hook (1 versión minor por hook)

Para cada hook confirmado, en un **solo commit** por hook:

1. **Crear** el hook en `src/hooks/data/<useX>.ts` con:
   - Tipado genérico donde aplique.
   - Manejo estándar: `loading | error | data`.
   - `error` de Supabase manejado (regla Power of 10).
   - Cleanup obligatorio en effects/channels.
2. **Test unitario** en `src/hooks/data/__tests__/<useX>.test.ts` cubriendo:
   - Happy path.
   - Error de Supabase.
   - Unmount durante fetch (no memory leak).
   - Cleanup de channels (para `useSupabaseRealtime`).
3. **Migrar** las N rutas que usaban el patrón viejo al nuevo hook — borrando el código inline.
4. **Validar:**
   - `tsgo` sin errores.
   - `vitest run` verde (incluye canaries existentes).
   - Playwright smoke sobre 1-2 rutas migradas (screenshot antes/después).
5. **Changelog** + `APP_VERSION` bump minor.

**Bump:** `minor` por hook.

## Fase 3 · Cierre (1 versión)

1. Marcar backlog agotado en `docs/refactor/dry-hooks-audit.md` (checklist).
2. Actualizar `mem://` con memoria nueva `technical/data-hooks-catalog` describiendo cada hook y cuándo usarlo.
3. Actualizar CHANGELOG con resumen del sprint (deltas: líneas eliminadas, sitios migrados).

**Bump:** `patch`.

---

## Detalles técnicos

### Contratos de hook (ejemplo `useSupabaseList`)

```ts
type UseSupabaseListOptions<T> = {
  table: string;
  select: string;                    // columnas explícitas (ver optimizacion-consultas)
  orgScoped?: boolean;               // agrega organization_id automáticamente
  filters?: Record<string, unknown>;
  search?: { column: string; term: string; debounceMs?: number };
  orderBy?: { column: string; ascending?: boolean };
  pageSize?: number;
  realtime?: boolean;                // usa useSupabaseRealtime internamente
};

type UseSupabaseListResult<T> = {
  data: T[];
  total: number;
  page: number;
  setPage: (p: number) => void;
  loading: boolean;
  error: PostgrestError | null;
  refetch: () => Promise<void>;
};
```

### Reglas no-negociables

- **Ninguno** de los hooks importa directamente componentes UI (solo `supabase` client + tipos + utils).
- Todo hook con `useEffect` retorna cleanup (regla Core de `mem://`).
- `error` de Supabase **siempre** manejado — nunca ignorado.
- Los hooks respetan multi-tenant: usan `useOrgId()` interno cuando `orgScoped: true`.
- Sin `any`. Genéricos + `Database['public']['Tables'][X]['Row']`.
- Cada hook ≤ 200 líneas (Power of 10).

### Criterios para descartar un candidato

- Menos de 3 sitios reales de duplicación → no se extrae (YAGNI).
- El patrón varía significativamente entre sitios (custom filters raros, joins específicos) → se documenta pero no se hoockea.
- Ya existe un wrapper equivalente en `src/lib/` → se reusa/extiende, no se duplica.

### Riesgos y mitigación

| Riesgo | Mitigación |
|---|---|
| Regresión en paginación server-side (usa `.range()` que ya tiene sutilezas) | Test unitario con mock Supabase + smoke Playwright de `/embarques` (ruta con más filas) |
| Realtime channels que hoy no limpian correctamente y "funcionan por accidente" | Test que verifica `removeChannel` se llama en unmount |
| Migraciones parciales dejan rutas mixtas (unas con hook, otras inline) | Cada hook se migra 100% en su commit — nada de "TODO migrar Y después" |
| Coverage threshold de Vitest se rompe al agregar hooks nuevos sin tests | Regla: test acompaña siempre al hook — nunca subir el hook sin su test (ver `mem://principles/coverage-threshold`) |

---

## Deliverables finales

- `src/hooks/data/*.ts` (5-7 hooks nuevos, cada uno ≤ 200 líneas).
- `src/hooks/data/__tests__/*.test.ts` (tests unitarios por hook).
- `docs/refactor/dry-hooks-audit.md` (reporte inicial con evidencia y checklist final).
- Rutas migradas al nuevo hook (0 código inline duplicado en la capa de datos).
- CHANGELOG con métricas: líneas eliminadas, sitios migrados por hook.
- Memoria nueva: `mem://technical/data-hooks-catalog`.

---

## Fuera de alcance (explícito)

- Refactor de componentes UI compartidos (cards, modales, headers) — se auditó pero se pospone.
- Consolidación de utils/validaciones (financial, docs faltantes) — pospuesto a otro sprint.
- Cambios en schema o RLS de Supabase.
- Cambios de negocio o comportamiento — este sprint es puramente estructural.

Al aprobar, arrancamos por Fase 0: publicar el audit del subagente y confirmar la lista final de hooks antes de escribir código.
