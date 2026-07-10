## Problema

El timeline del Dashboard sólo muestra 5 estados (Confirmado, En Tránsito, Arribo, En Aduana, Entregado). Los embarques en **EIR** y **Cerrado** existen en el sistema pero no aparecen, así que el resumen se ve incompleto.

Decisión (confirmada): mostrar los 5 activos actuales **+ EIR + Cerrado** = 7 nodos. Se omite `Borrador` (trabajo en curso) y `Cancelado`.

## Cambios

### 1. Backend — nueva migración de `dashboard_summary`
Archivo: `supabase/migrations/<timestamp>_dashboard_summary_eir_cerrado.sql`
- `CREATE OR REPLACE FUNCTION public.dashboard_summary()` (mismo cuerpo, sólo cambia el CTE `conteo`):
  - Contar sobre `embarques_base` (no sobre `activos`) para incluir EIR y Cerrado.
  - Añadir dos claves al `jsonb_build_object`: `'EIR'` y `'Cerrado'`.
- `totalActivos`, `arribosEsteMes` y `resumenMesSiguiente` **no cambian** (siguen excluyendo EIR/Cerrado/Cancelado). Sólo el conteo del timeline se amplía.

### 2. Frontend — tipo y contrato
Archivo: `src/features/dashboard/domain/parsers/dashboardTypes.ts`
- Crear `const ESTADOS_TIMELINE = [...ESTADOS_ACTIVOS, 'EIR', 'Cerrado'] as const;`
- `ESTADOS_FILTRO = ESTADOS_TIMELINE` (re-export mantiene la API pública del hook).
- Extender `EMPTY_CONTEO` con `EIR: 0, Cerrado: 0`.

### 3. Scope "mios" en el controller
Archivo: `src/features/dashboard/hooks/useDashboardController.ts`
- Ya recorre `ESTADOS_FILTRO` para construir `conteo`, así que hereda EIR/Cerrado automáticamente.
- Verificar que las listas fuente (`alertasDemora`, `proximosArribos`, `profitArribosEsteMes`, `embarquesMesSiguiente`) contienen embarques EIR/Cerrado — si no, el conteo scoped mostrará 0 en esos nodos. Ese es el comportamiento aceptable para "mis embarques" (los cerrados no aparecen en KPIs operativos activos). No se modifican las listas.

### 4. Preservar "Cargas Activas por Cliente"
Archivo: `src/features/dashboard/components/CargasActivasClienteCard.tsx`
- Su `ESTADOS_ORDEN` local ya lista sólo los 5 activos y no debe cambiar (la tarjeta habla de "activas"). Cambiar el tipo de `Record<EstadoFiltro, number>` a `Partial<Record<EstadoFiltro, number>>` para que TS no exija EIR/Cerrado.

### 5. Housekeeping
- `CHANGELOG.md` + bump `APP_VERSION` (`13.251.1` → `13.252.0`).
- Ajustar el test `dashboard.test.ts` / `dashboard.extra.test.ts` para el nuevo shape de `EMPTY_CONTEO` (7 claves).

## Detalles técnicos

```text
Timeline (nuevo): Confirmado → En Tránsito → Arribo → En Aduana → Entregado → EIR → Cerrado
```

- El `TimelineEstadosCard` ya mapea `ESTADOS_FILTRO` con `ESTADO_CONFIG` de `src/lib/ui/estadoConfig.ts`; verificaré que ambas claves `EIR` y `Cerrado` existan ahí (si falta alguna icon/gradient, se añade en el mismo archivo).
- El overflow horizontal del card ya está previsto (`overflow-x-auto min-w-[480px]`), así que 7 nodos caben en desktop y hacen scroll en mobile.
- El link `onClick` navega a `/embarques?estado=<estado>`; ese filtro ya acepta EIR/Cerrado (son valores de la columna `estado`), no hay cambio ahí.

## Riesgo
Bajo. El RPC amplía el JSON (retro-compatible), el frontend suma dos nodos y los consumidores puntuales están controlados.
