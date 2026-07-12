# Auditoría de la implementación de React

## Estado actual (lo que ya está top-of-the-line)

| Área | Estado |
|---|---|
| React | 19.0.2 (mayor actual). Types 19.0.10. |
| Vite / TS | Vite 5.4, TS 5.9 (los pins de plataforma). |
| StrictMode | Activo en `main.tsx`. |
| React Compiler | Instalado en modo `annotation` con plugin Vite propio. |
| ErrorBoundary raíz | Cubriendo router + providers. |
| Auto-recovery de chunks stale | Implementado (vite:preloadError + unhandledrejection + error). |
| Sentry + Query persister | Lazy fuera del critical path. |
| Higiene TS | 0 `any`, 0 `React.FC`, 0 `PropTypes`, 0 `eslint-disable`, 0 `exhaustive-deps` disabled. |
| Data fetching | 109 `useQuery`, mutations via React Query. |
| Memoización manual | 306 `useMemo` + 172 `useCallback` + 16 `React.memo`. |

**Diagnóstico**: es una implementación limpia y disciplinada. Los "olores" restantes son de segunda derivada — no hay bugs, hay oportunidades de modernización que React 19 abrió y que aún no aprovechamos.

## Brechas frente al estándar React 19 "top of the line"

1. **`forwardRef` legacy en 33 archivos** — todos los primitives de `components/ui/*`. React 19 acepta `ref` como prop normal; `forwardRef` está deprecado (funciona, pero es ruido).
2. **APIs React 19 sin usar**: `use()` (0), `useOptimistic` (0), `useActionState` (0), `useFormStatus` (0). `useTransition`/`useDeferredValue` sólo en 3 archivos.
3. **React Compiler sub-utilizado**: sólo 2 archivos con `"use memo"` (`Embarques`, `Cotizaciones`). El compiler puede reemplazar la mayoría de esos 306 `useMemo` + 172 `useCallback` manuales si se activa en más rutas calientes.
4. **12 archivos con patrón imperativo `useState` + `useEffect` + `supabase`** — deberían ser `useQuery`.
5. **Sin `queryOptions()` factories** (React Query 5) — 109 `useQuery` con keys inline pierden tipado end-to-end y facilitan invalidaciones inconsistentes.
6. **Granularidad Suspense/ErrorBoundary baja**: 1 Suspense global + 4 ErrorBoundaries. Una caída en una ruta puede bajar toda la sección autenticada.
7. **React 19.1/19.2 disponibles** — no bloqueante, pero traen `<Activity>` y mejoras del compiler.

---

## Plan de 5 fases

Cada fase es autónoma y verificable con `typecheck + build + tests`. Se puede pausar entre fases.

### Fase 1 — Data fetching disciplinado (riesgo bajo)
- Auditar los 12 archivos que mezclan `useState`+`useEffect`+`supabase` y migrarlos a `useQuery` (elimina memory leaks potenciales y estados intermedios inconsistentes).
- Introducir el patrón `queryOptions()` de React Query 5: un factory tipado por dominio (`embarquesQueries.ts`, `cotizacionesQueries.ts`, etc.) que expone `list()`, `byId(id)`, `dashboard()`, con keys estables. Refactorizar incrementalmente los 109 `useQuery` para consumirlo.
- Bump a **React 19.2** (última estable) y `@types/react` correspondiente.

### Fase 2 — Expandir React Compiler a rutas calientes
- Agregar `"use memo"` a los 8-10 componentes-ruta con más re-renders: `Dashboard`, `Facturacion`, `CotizacionDetalle`, `EmbarqueDetalle`, `Oportunidades`, `Cxp`, `Configuracion`, `AuditoriaPage`.
- Activar `eslint-plugin-react-compiler` en modo `error` (hoy es `warn`) para los archivos anotados, así se garantiza que las "rules of react" no se rompen en ese subset.
- Medir: comparar cantidad de `useMemo`/`useCallback` manuales en esos archivos y remover los que el compiler ya cubre (opcional, no urgente).

### Fase 3 — Modernizar primitives (mecánico, opt-in por archivo)
- Migrar los 33 `components/ui/*.tsx` de `forwardRef((props, ref) => ...)` a `({ref, ...props}: Props & {ref?: Ref<...>}) => ...` (patrón oficial React 19).
- No romper la API pública de shadcn (los consumidores siguen pasando `ref={...}` igual).
- Un archivo por PR conceptual; empezar por los menos usados (Alert, Badge, Progress) y terminar por los críticos (Button, Dialog, Select).

### Fase 4 — Adoptar APIs React 19 donde aportan valor
- **`useOptimistic`**: en listas con delete/toggle (facturas, cotizaciones, oportunidades) para respuesta instantánea antes del round-trip.
- **`useTransition`**: envolver cambios de tab, filtros de tablas grandes y navegaciones lazy para evitar bloqueo del hilo.
- **`useDeferredValue`**: extender de 3 → todas las `DataTable` con filtros de texto (embarques, cotizaciones, facturas, clientes, proveedores).
- **`use()`**: candidato claro sólo si migramos algún context leído condicionalmente; **no** para reemplazar `useQuery`.
- **`useActionState` / `<form action>`**: **descartado** — RHF cubre todos los formularios con validación Zod. Mantener consistencia gana sobre novedad.

### Fase 5 — Granularidad de Suspense y ErrorBoundary
- ErrorBoundary por módulo de feature (embarques, cotización, facturación, cxp, configuración) para que un crash aisle la sección y muestre CTA de recarga en vez de tumbar toda la app autenticada.
- `<Suspense>` por ruta con skeletons específicos (hoy hay un fallback global genérico). El chunk load de `AuditoriaPage` (205 KB) o `EmbarqueDetalle` (210 KB) merece skeleton propio.
- Evaluar `<Activity mode="hidden">` (React 19.2) para pre-renderizar rutas frecuentes (Dashboard ↔ Embarques) sin costo visible.

---

## Sección técnica (referencia)

### Ejemplo `queryOptions` factory (fase 1)
```ts
// features/embarques/api/embarquesQueries.ts
import { queryOptions } from "@tanstack/react-query";
export const embarquesQueries = {
  all: () => ["embarques"] as const,
  list: (filters: EmbarqueFilters) =>
    queryOptions({
      queryKey: [...embarquesQueries.all(), "list", filters],
      queryFn: () => fetchEmbarques(filters),
    }),
  byId: (id: string) =>
    queryOptions({
      queryKey: [...embarquesQueries.all(), "detail", id],
      queryFn: () => fetchEmbarque(id),
    }),
};
```

### Ejemplo migración forwardRef (fase 3)
```tsx
// Antes
const Alert = React.forwardRef<HTMLDivElement, AlertProps>((props, ref) => (
  <div ref={ref} {...props} />
));

// Después (React 19)
type AlertProps = React.HTMLAttributes<HTMLDivElement> & {
  ref?: React.Ref<HTMLDivElement>;
};
function Alert({ ref, ...props }: AlertProps) {
  return <div ref={ref} {...props} />;
}
```

### Verificación por fase
Cada fase termina con:
- `bun run typecheck && bun run lint && bun run build`
- `bun run test:fast` sobre los archivos tocados
- Bump `APP_VERSION` + entrada en `CHANGELOG.md`

### Fuera de alcance
- Migrar formularios de RHF → `useActionState` (rompe consistencia, sin ganancia clara).
- Introducir Server Components (no aplica a un SPA Vite).
- Cambiar React Query por otro data-layer.

---

**¿Arrancamos por la Fase 1 o prefieres invertir el orden (Fase 2 primero para ver ganancia visible del compiler antes de tocar data)?**
