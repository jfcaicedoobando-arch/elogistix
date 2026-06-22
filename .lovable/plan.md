## Bug

En `DialogDetallePagosProveedor` → sección **Historial**: al cerrar/abrir el collapsible, a veces aparece "Sin eventos registrados aún." aunque la factura sí tenga eventos.

## Causa raíz

`src/features/cxp/components/HistorialFacturaSection.tsx` ignora `isError`/`error`/`isFetching` del hook. El UI sólo distingue dos estados (`isLoading` → skeleton, resto → lista o "Sin eventos"). Cuando:

- la RPC `historial_proveedor_factura` regresa error (token caduco, red, etc.), `data` queda `undefined` → `eventos = []` → muestra "Sin eventos" **silenciosamente** (sin manera de saber que falló).
- el collapsible re-habilita la query y se dispara un refetch en background, `isLoading` ya es `false` (sólo es `true` la primera vez); si el refetch termina con error o tarda, la UI parpadea a "Sin eventos".

## Cambios

### 1. `src/features/cxp/components/HistorialFacturaSection.tsx`
- Destructurar también `error`, `isError`, `isFetching`, `refetch` del hook.
- Nuevo orden de estados:
  1. `isLoading` (primera carga) → skeleton actual.
  2. `isError` → mensaje rojo "No se pudo cargar el historial." + botón **Reintentar** que llama `refetch()`. Muestra `error.message` truncado en `text-xs` para diagnóstico.
  3. `eventos.length === 0 && !isFetching` → "Sin eventos registrados aún." (el real "no data").
  4. lista de eventos (mostrar también un indicador sutil `…actualizando` si `isFetching && eventos.length > 0`).

### 2. `src/features/cxp/hooks/useHistorialFactura.ts`
- Agregar `placeholderData: (prev) => prev` (equivalente a `keepPreviousData` en RQ v5) para que al re-habilitar la query (cerrar/abrir collapsible) los eventos previos sigan visibles durante el refetch en lugar de parpadear a vacío.
- Mantener `staleTime: 30_000`.

### 3. Tests rápidos
- No agregar tests nuevos en este parche (la sección no tiene tests existentes). Verificar manualmente:
  - Abrir Detalle de pagos de la factura USD 62 30/03/2026 → expandir Historial → ver 4 eventos (creada, aprobada, pago, bitácora).
  - Cerrar/abrir el collapsible varias veces → los eventos deben permanecer visibles sin parpadear a "Sin eventos".
  - Simular error (devtools → Network → bloquear request `historial_proveedor_factura`) → ver mensaje rojo + botón Reintentar.

### 4. Versionado y changelog
- `src/constants/appVersion.ts`: `13.106.10` → `13.106.11`
- `CHANGELOG.md`: `## [13.106.11] - 2026-06-22` → "**fix(cxp)**: la sección Historial del modal Detalle de pagos ya no muestra 'Sin eventos' cuando la RPC falla o se está refetcheando. Surface explícito de errores con botón Reintentar y `placeholderData` para evitar parpadeo al cerrar/abrir el collapsible."

## No se toca

- La RPC `public.historial_proveedor_factura` está bien (devuelve los 4 eventos esperados; los GRANTs a `authenticated` están).
- La query key, el `staleTime` ni la lógica de `enabled` cambian.
- El resto del `DialogDetallePagosProveedor`.

## Analogía 🛎️

Es como un timbre que sólo suena la primera vez que tocan la puerta: si después llega alguien y no abren, asumes "no hay nadie". Lo que vamos a hacer es: 1) que el timbre suene también cuando hay un problema (mostrar el error), y 2) que la mirilla recuerde quién vino la última vez mientras vuelves a revisar (`placeholderData`), en lugar de ponerse en blanco.
