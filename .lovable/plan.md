## Cambio

Quitar `Cerrado` del timeline del Dashboard. Queda: Confirmado → En Tránsito → Arribo → En Aduana → Entregado → **EIR** (6 nodos).

## Archivos

1. **`supabase/migrations/<timestamp>_dashboard_summary_solo_eir.sql`** — nueva migración `CREATE OR REPLACE FUNCTION public.dashboard_summary()` idéntica a la actual pero sin la clave `'Cerrado'` en el `jsonb_build_object` de `conteo`.
2. **`src/features/dashboard/domain/parsers/dashboardTypes.ts`**
   - `ESTADOS_FILTRO = [...ESTADOS_ACTIVOS, "EIR"] as const;`
   - Remover `Cerrado: 0` de `EMPTY_CONTEO`.
3. **`src/features/dashboard/domain/parsers/dashboard.ts`** — remover la línea `Cerrado: Number(raw["Cerrado"] ?? 0)` en `parseConteoPorEstado`.
4. **`src/features/dashboard/domain/parsers/__tests__/dashboard.test.ts`** — actualizar el test que verifica las 7 claves para que sean 6 (sin `Cerrado`).
5. **`CHANGELOG.md`** + **`src/constants/appVersion.ts`** → `13.252.1`.

## Notas

- `CargasActivasClienteCard.tsx` no cambia (ya usa `Partial<Record<EstadoFiltro, number>>`).
- `estadoConfig.ts` puede conservar la config de `Cerrado` (se usa en otras vistas como `/embarques`); solo se remueve del timeline.
- Riesgo bajo: retrocompatible, sólo se reduce el JSON del RPC.
