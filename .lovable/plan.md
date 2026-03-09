

## Línea de tiempo visual + Indicador de arribos del mes

### Archivos a modificar (3)

**1. `src/hooks/useDashboardData.ts`**
- Cambiar `arribosEsteMes` de `number` a un objeto con `{ total, yaLlegaron, enCamino }` usando la lógica proporcionada por el usuario
- Filtrar `embarquesConEstado` por ETA dentro del mes, luego subdividir por `estadoReal`

**2. `src/components/dashboard/DashboardStatusCards.tsx`** — Reescribir completamente
- **CAMBIO 1 — Línea de tiempo horizontal:**
  - Reemplazar la grid de cards por una línea de tiempo dentro de un solo `Card`
  - 5 nodos conectados por líneas horizontales: Confirmado → En Tránsito → Arribo → En Aduana → Entregado
  - Cada nodo: ícono circular con gradiente de color (de `estadoConfig`), conteo grande debajo, label del estado
  - Líneas conectoras entre nodos con color degradado
  - Click en cada nodo filtra la tabla (toggle on/off como antes)
  - Nodo seleccionado: ring/glow + scale-up; hover: scale sutil
  - Responsive: en móvil los nodos se apilan o se hacen scroll horizontal

- **CAMBIO 2 — Indicador de arribos del mes:**
  - Debajo de la línea de tiempo, un `Card` compacto con:
    - Ícono `CalendarDays` + título "Arribos este mes"
    - 3 métricas en fila: Total | Ya llegaron | En camino
    - Barra de progreso mostrando `yaLlegaron / total`

**3. `src/pages/Dashboard.tsx`**
- Extraer los nuevos campos del hook (`arribosEsteMes` ahora es objeto)
- Pasar los datos actualizados a `DashboardStatusCards`

### Diseño visual (línea de tiempo)

```text
┌──────────────────────────────────────────────────────────────────┐
│  ●────────●────────●────────●────────●                          │
│  Confirmado  En Tránsito  Arribo  En Aduana  Entregado          │
│     3           5          2        1           4               │
└──────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────┐
│  📅 Arribos este mes: 8    Ya llegaron: 5    En camino: 3       │
│  ████████████████░░░░░░░░░  63%                                 │
└──────────────────────────────────────────────────────────────────┘
```

