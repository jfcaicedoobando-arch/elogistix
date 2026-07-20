## Causa raíz

`TimelineEstadosCard` recorre `ESTADOS_FILTRO = [...ESTADOS_ACTIVOS, "EIR"]`, que hoy incluye `Cotización`, `En Proceso` y `Llegada`. Estos tres estados **no** existen como clave en `ESTADO_CONFIG` (`src/lib/ui/estadoConfig.ts`), así que `ESTADO_CONFIG[estado]` devuelve `undefined` y `cfg.icon` explota.

El archivo ya expone un `DEFAULT_VISUAL` y un helper `getEstadoVisual(estado)` justamente para este caso, pero la tarjeta accede al mapa directo.

## Fix

1. **`src/features/dashboard/components/statusCards/TimelineEstadosCard.tsx`** — reemplazar `ESTADO_CONFIG[estado]` por `getEstadoVisual(estado)` (import del mismo módulo). Blindaje contra futuros estados sin config.

2. **`src/lib/ui/estadoConfig.ts`** — agregar entradas visuales para los tres estados faltantes con iconos apropiados de lucide (`FileText` para Cotización, `Loader2` para En Proceso, `Anchor`/`MapPin` para Llegada) y clases coherentes con el resto de la paleta (info/warning/state-arribo).

3. **Bump** `APP_VERSION` → `13.303.7` + entrada en `CHANGELOG.md`.

4. **Sentry**: marcar el issue como resolved al terminar.

No se toca lógica de datos ni tests existentes.
