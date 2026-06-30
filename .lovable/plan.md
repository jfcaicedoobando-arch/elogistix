## Auditoría visual `/costeo/tarifas?aprob=pendientes`

Capturé la pantalla en el viewport del usuario (928×635) y en escritorio. Los hallazgos son:

### Qué está roto

1. **Vista Agrupada (`TarifaFila.tsx`) — botones rápidos invisibles e inutilizables.**
   El grid de la fila termina en una columna de solo **56 px** para acciones. Sin embargo, los botones inline "Aprobar" y "Duplicar" se renderizan ahí dentro con `opacity-0 group-hover:opacity-100`. Esto significa:
   - Sin mouse (touch, teclado) son invisibles.
   - Aun con hover, los botones miden ~180 px y no caben en 56 px → se cortan o se montan sobre la columna del precio.

2. **Vista Tabla (`CosteoTarifasTable.tsx`) — Aprobar/Rechazar escondidos en el kebab.**
   La única forma de aprobar es abrir el `…` en cada fila. Para 5 pendientes son mínimo 10 clicks. No hay botones inline.

3. **Viewport ≤ 980 px — scroll horizontal y menú que tapa filas.**
   En la Tabla la columna "Ruta" queda fuera; al abrir el `…`, el menú se monta sobre la siguiente fila (ver captura adjunta).

4. **KPI "5 pendientes aprobación" no es interactivo.**
   El usuario ve el conteo pero tiene que cambiar manualmente el filtro `Aprob:` para llegar a la lista.

5. **No hay acciones masivas.**
   No se puede aprobar/rechazar varias tarifas seleccionadas en un solo paso (mismo problema que ya resolvimos en Auditoría con `HallazgosBulkBar`).

### Plan de remediación (3 fases)

**Fase A — Acciones inline siempre visibles (corrige el bug principal).**
- `TarifaFila.tsx`: cambiar `FILA_GRID` para que la última columna sea `auto` (~ 220 px) y mostrar **Aprobar** (verde) + **Rechazar** (rojo) como botones reales cuando `estado_aprobacion === "borrador"`. Quitar el patrón `opacity-0 group-hover:`. Mantener el kebab solo para Editar/Duplicar/Eliminar/Reactivar.
- `CosteoTarifasTable.tsx`: ampliar la columna Acciones y agregar los mismos dos botones icon-only con tooltip ("Aprobar", "Rechazar") al lado del kebab para filas pendientes.
- En estados distintos a "borrador" solo se muestra el kebab (sin desbalanceo).

**Fase B — KPI clickable + filtro persistente.**
- Convertir la card "Pendientes aprobación" en un botón que aplica `aprob=pendientes` (y resalta como filtro activo).
- Las otras 3 cards (vigentes hoy, por vencer, rutas cubiertas) también pasan a ser atajos.

**Fase C — Responsive < 1024 px.**
- En la Tabla, ocultar las columnas **Flete** y **Recargos** (el Total ya las consolida). Mantener Ruta · Agente · Total · Vigencia · Estado · Acciones siempre visibles.
- En el `DropdownMenuContent` agregar `sideOffset` y `collisionPadding={8}` para que el menú no se monte sobre filas adyacentes en viewports angostos.

### Detalle técnico

```
src/features/costeo/components/
  ├── TarifaFila.tsx          ← Fase A: grid + botones inline
  ├── CosteoTarifasTable.tsx  ← Fase A + C: columna acciones + hidden md:table-cell
  ├── TarifaRowActions.tsx    ← solo Editar/Duplicar/Eliminar (mover Aprobar/Rechazar fuera)
  └── (nuevo) TarifaQuickApprovalButtons.tsx  ← componente compartido
src/features/costeo/routes/
  └── CosteoTarifas.tsx       ← Fase B: KPIs clickables
```

Componente compartido `TarifaQuickApprovalButtons` con dos variants:
- `variant="row-grouped"` → botones con texto.
- `variant="row-table"` → solo iconos con tooltip (para no romper la tabla).

Fuera de scope: la barra flotante de selección masiva queda anotada como sugerencia (Fase D opcional) — si la quieres también, la sumo.

### Qué NO toco

- Lógica de `useAprobacionTarifa` (queda intacta).
- Diálogo `DialogRechazarTarifa` (queda igual).
- Permisos / RLS.

Avísame si quieres incluir la **Fase D (selección masiva)** o sólo A+B+C.