

## Mini gráfico de tendencia de arribos por semana

**Objetivo**: Agregar un pequeño gráfico de barras en la tarjeta de "Arribos este mes" que muestre el desglose semanal (Sem 1, Sem 2, Sem 3, Sem 4/5) de los arribos del mes.

### Diseño visual

```text
┌─ Arribos este mes ─────────────────────────────────────────────┐
│ 🗓 Total: 28   ✓ Ya llegaron: 12   🚢 En camino: 16   │ $X   │
│                                                                │
│   S1    S2    S3    S4    S5   ← mini barras (80px alto)       │
│   ██    ██                                                     │
│   ██    ██    ██                                               │
│   ██    ██    ██    ██    ██                                   │
│   5     8     7     5     3                                    │
└────────────────────────────────────────────────────────────────┘
```

### Cambios

**1. Migración SQL** — Agregar un CTE `arribos_semana` al RPC `dashboard_stats()` que calcule el conteo de embarques por semana del mes (basado en ETA), retornado como un array JSON:
```json
[{"semana": "S1", "count": 5}, {"semana": "S2", "count": 8}, ...]
```
Se agrupará por `EXTRACT(WEEK FROM eta) - EXTRACT(WEEK FROM v_inicio_mes) + 1` y se incluirá como `arribosPorSemana` en el resultado.

**2. `src/hooks/useDashboardData.ts`** — Parsear el nuevo campo `arribosPorSemana` del RPC y exponerlo como `arribosPorSemana: {semana: string, count: number}[]`.

**3. `src/components/dashboard/DashboardStatusCards.tsx`** — Importar `MiniBarChart` de `OperacionesWidgets` (o usar Recharts directamente). Agregar el mini gráfico de barras debajo de las métricas actuales, o a la derecha en pantallas grandes, mostrando las barras semanales.

**4. `src/pages/Changelog.tsx`** — Entrada v8.1.1.

### Archivos a modificar
- Nueva migración SQL (actualizar `dashboard_stats`)
- `src/hooks/useDashboardData.ts`
- `src/components/dashboard/DashboardStatusCards.tsx`
- `src/pages/Changelog.tsx`

