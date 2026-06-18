# Auditoría visual — Modal "Buscar tarifa marítima (Top 3)"

## Problemas detectados en la captura

Revisé `BuscarTarifaDialog.tsx` + `TarifaResultCard.tsx` contra la imagen del usuario (vista móvil 343px). Hallazgos por prioridad:

### 🔴 Críticos (rompen la lectura)

1. **Etiqueta y valor pegados sin espacio**: se lee `FleteUSD 6,100.00` y `RecargosUSD 35.00 base`. Causa: `<div className="flex justify-between">` con texto largo en columna estrecha colapsa el espacio entre los dos `<span>`. En móvil con `grid-cols-2` cada celda queda muy angosta y se desborda.
2. **Layout 2 columnas en móvil**: `grid grid-cols-2 gap-2` para Flete/Recargos en un card de ~160px de ancho es ilegible. Debería ser 1 columna en móvil.
3. **El modal usa `md:grid-cols-3` pero el contenido NO cabe** en móvil dentro del Dialog (`max-w-4xl`); las cards se sienten apretadas.
4. **Jerarquía visual débil del "ganador" (#1)**: sólo cambia border-color sutil; no se distingue claramente del #2/#3. El usuario no sabe a primera vista cuál es la mejor opción.

### 🟡 Importantes (claridad semántica)

5. **"Total comparable"**: término técnico que confunde. Mejor "Total estimado" o "Costo total" con tooltip explicando qué incluye.
6. **Desglose de recargos siempre visible**: ocupa mucho espacio y compite con la info principal. Debería ser colapsable ("Ver desglose").
7. **Badges mezcladas sin agrupar**: crédito, días libres, tránsito, demora día 6 — todas iguales visualmente. Falta agrupar por tipo (comercial vs operativo).
8. **"Demora día 6: USD X/día"** aparece como warning sin contexto. Usuario no sabe si es bueno o malo.
9. **Vigencia al fondo en texto chico**: dato relevante (puede vencer pronto) pierde prominencia. Sin badge de "vence pronto" si <7 días.
10. **Botón "Elegir esta"** ocupa todo el ancho pero sin íconografía/jerarquía diferenciada para #1 vs #2/#3.

### 🟢 Mejoras de UX

11. **Filtros en el header del Dialog**: 4 selects en `grid-cols-2 md:grid-cols-4` ocupan demasiado espacio en móvil antes de ver resultados. Debería poder colapsarse tras la primera búsqueda.
12. **Falta indicador de "mejor por…"**: el #1 podría tener chip "Mejor precio", #2 "Mejor crédito", etc. (el RPC ya ordena por precio/crédito/días libres).
13. **Carta garantía**: el badge en esquina superior derecha compite por atención con el rank. Considerar moverlo a la fila de badges o al footer.
14. **No hay comparador rápido**: ver 3 cards lado a lado en desktop es bueno, pero falta resaltar las diferencias clave (delta de precio vs #1, p.ej. "+USD 554" en #2).
15. **Sin "Elegir" sticky en mobile**: el botón queda al fondo del card; con desglose largo requiere scroll dentro del modal.

## Plan de mejoras propuesto

### Fase 1 — Legibilidad inmediata (P0)

- En `TarifaResultCard.tsx`:
  - Reemplazar `flex justify-between` por estructura con `min-w-0` + `gap-2` explícito y `truncate` en label, valor con `tabular-nums` y `whitespace-nowrap`.
  - Cambiar `grid grid-cols-2 gap-2` del bloque Flete/Recargos a `flex flex-col gap-1.5` (1 columna siempre, más legible).
  - Total comparable: subir tamaño (`text-xl`), fondo sutil `bg-muted/50` con padding propio para destacar.
- En `BuscarTarifaDialog.tsx`:
  - En móvil cambiar grid de resultados a `grid-cols-1` con cards apiladas; `md:grid-cols-2 lg:grid-cols-3`.
  - Ampliar `max-w-4xl` → `max-w-5xl` para que en desktop respiren las cards.

### Fase 2 — Jerarquía del ganador (P0)

- Card #1: badge prominente "🏆 Mejor opción" arriba, fondo `bg-success/10`, border `border-success` (2px), sombra suave. Botón "Elegir esta" con `variant="default"` y tamaño mayor.
- Cards #2/#3: visual más neutro, botón `variant="outline"`. Mostrar delta vs #1: `+USD 554 vs #1` debajo del total.

### Fase 3 — Información colapsable y agrupada (P1)

- Desglose de recargos: usar `<details>` o `<Collapsible>` con label "Ver desglose ({n} recargos)" — colapsado por defecto en móvil, abierto en desktop.
- Renombrar "Total comparable" → "Costo total estimado" con `<Tooltip>` que explique "Flete base + todos los recargos vigentes a la fecha seleccionada".
- Agrupar badges en 2 filas semánticas:
  - Fila comercial: Crédito · Vigencia · Carta garantía
  - Fila operativa: Tránsito · Días libres · Demora día 6 (con tooltip "Costo por día después del periodo libre")

### Fase 4 — Comparación inteligente (P1)

- Mostrar etiqueta dinámica "Mejor precio" / "Más crédito" / "Más días libres" según en qué métrica gana cada card (cálculo en cliente comparando los 3 rows).
- Badge "Vence pronto" en rojo si `vigente_hasta` está a ≤7 días.

### Fase 5 — Header del Dialog (P2)

- Mostrar resumen compacto de filtros aplicados (ej: "Shanghái → Manzanillo · 40' HC · 18/06/2026") con botón "Cambiar" que despliega los selects.
- Reduce ruido visual cuando ya hay resultados.

## Detalles técnicos

Archivos a modificar:

- `src/features/costeo/components/TarifaResultCard.tsx` — refactor visual completo, props nuevas (`esGanador`, `etiquetaMejorEn`, `deltaVsGanador`).
- `src/features/costeo/components/BuscarTarifaDialog.tsx` — grid responsive, header colapsable.
- `src/features/costeo/routes/CosteoBuscar.tsx` — aplicar misma lógica de etiquetas/delta.
- Helper nuevo `src/features/costeo/utils/rankingLabels.ts` — calcula etiquetas "Mejor en X" comparando rows.

Sin cambios en backend (RPC `get_top_tarifas`), tipos, ni lógica de selección. Sólo presentación.

## Validación

- Playwright en viewport 390×844 (móvil) navegando a `/costeo/buscar` con filtros pre-llenados; screenshot de las 3 cards y verificar que ningún texto se pegue.
- Repetir en 1280×800 (desktop).
- `APP_VERSION` → `13.67.4`, entrada en `CHANGELOG.md`.

## Fuera de alcance

- Cambios al RPC o esquema de tarifas.
- Lógica de selección/aplicación al wizard de cotización.
- Rediseño completo del módulo Costeo.

¿Procedo con todas las fases, o prefieres que arranque sólo con P0 (Fases 1 y 2) y validamos antes de seguir? Todas las fases 