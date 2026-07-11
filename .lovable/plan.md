## Objetivo

El módulo `/cartera` hoy muestra **todas** las facturas con saldo > 0 (vigentes lejanas, por vencer, vencidas). Vamos a enfocarlo en cobranza accionable: **sólo vencidas + por vencer en ≤7 días**, con posibilidad de ampliar el rango si el usuario lo necesita.

## Cambios

### 1. Filtro por defecto en la UI (`Cartera.tsx`)
- Reemplazar el filtro binario `vencidas: "todas" | "si" | "no"` por `urgencia`, con 4 opciones:
  - **"accionable"** (por defecto): vencidas + por vencer en ≤7 días.
  - `"vencidas"`: sólo `dias_vencido > 0`.
  - `"por_vencer"`: `-7 ≤ dias_vencido ≤ 0`.
  - `"todas"`: comportamiento anterior (para consultas puntuales).
- Ajustar `filterPredicate` acorde. `dias_vencido` ya viene del RPC (positivo = vencidas, negativo = días restantes para vencer).
- Actualizar los KPIs para reflejar el subset filtrado, manteniendo "Vencido" como sub-KPI de lo vencido puro.
- Agregar un chip visual "Por vencer ≤7d" además de "Vencida" en la columna de estado.

### 2. RPC `cartera_pendiente` — sin cambios
El RPC ya filtra por `saldo > 0`, así que las pagadas siguen ocultas (respuesta a la 2ª pregunta). El filtro de urgencia se aplica en cliente para conservar flexibilidad del toggle.

### 3. Descripción del módulo
- Actualizar el `description` del header a algo como: "Facturas vencidas y por vencer en los próximos 7 días. Cambia el filtro de urgencia para ver toda la cartera."

### 4. Tests
- Extender `aggregates.test.ts` (o crear `carteraFilter.test.ts`) para cubrir el nuevo predicado con casos: vencida (+10d), por vencer (-3d), lejana (-30d), justo hoy (0d).

### 5. Housekeeping
- `APP_VERSION` → `13.253.3`.
- Entrada en `CHANGELOG.md`.

## Fuera de alcance
- Notificaciones automáticas por facturas próximas a vencer.
- Cambios en el RPC o en la lógica de KPIs del Dashboard principal.
- Separar en dos pestañas Cobranza/Cartera (se descartó a favor del filtro de urgencia).

## Analogía

Antes: el buzón de cobranza era como una bandeja de entrada sin filtro — te salían correos de hace 2 años junto con los urgentes de hoy. Ahora, por defecto sólo ves lo que vence esta semana o ya venció, y hay un botón por si quieres ver todo el archivo.
