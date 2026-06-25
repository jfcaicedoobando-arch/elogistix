## Fase D — Acciones contextuales y refinamientos finales

Cierre del rediseño de `/costeo/tarifas`. Foco: acelerar decisiones del usuario (aprobar/comparar/duplicar) y pulir detalles de jerarquía visual que quedaron sueltos tras A/B/C.

### 1. Acciones rápidas en hover (fila)
En `TarifaFila.tsx`, mostrar acciones inline al hacer hover sobre una fila (además del kebab que ya existe):
- **Aprobar** (solo si `estado_aprobacion = 'borrador' | 'pendiente'`)
- **Duplicar** (clonar la tarifa con vigencia nueva — atajo para renovaciones)
- **Ver detalle**

Visibles con `opacity-0 group-hover:opacity-100` para no saturar; el kebab queda como fallback con todas las acciones.

### 2. Comparador rápido en grupo
En el header de cada grupo (`TarifasGroupedView.tsx`), cuando hay 2+ tarifas vigentes, mostrar un mini-resumen:
`Mejor USD 1,200 · Promedio USD 1,310 · Δ máx USD 240`
Ayuda al usuario a saber de un vistazo si vale la pena expandir el grupo.

### 3. Empty state y zero-results diferenciados
- **Sin tarifas en absoluto**: ilustración + CTA "Nueva tarifa".
- **Con filtros aplicados pero 0 resultados**: mensaje específico + botón "Limpiar filtros".
Hoy ambos casos muestran el mismo placeholder.

### 4. Indicador de "tarifa recién creada"
Badge sutil `Nueva` (verde, 7 días) en filas creadas recientemente para que el usuario que acaba de cargar varias rutas las identifique fácilmente al regresar.

### 5. Refinamientos visuales pendientes de A–C
- Alinear el chip **Mejor** del header con la columna "Estado" del grid (hoy queda flotando a la izquierda).
- Reducir padding vertical del header de grupo en ~4px (se ve más alto que las filas).
- En vista Tabla, aplicar el mismo tratamiento de delta `+USD X vs mejor` que ya tiene la vista Agrupada.

### Archivos a tocar
- `src/features/costeo/components/TarifaFila.tsx` — acciones hover + badge "Nueva"
- `src/features/costeo/components/TarifasGroupedView.tsx` — mini-resumen comparador, alineación chip, padding header
- `src/features/costeo/components/TarifasEmptyState.tsx` (nuevo) — empty states diferenciados
- `src/features/costeo/routes/CosteoTarifas.tsx` — wire-up empty states y delta en vista Tabla
- `src/features/costeo/hooks/useDuplicarTarifa.ts` (nuevo) — mutation para duplicar
- `CHANGELOG.md` + `src/constants/appVersion.ts` → `13.135.54`

### Fuera de alcance (queda para otra iteración)
- Bulk actions (seleccionar varias tarifas y aprobar en lote).
- Export a CSV/Excel.
- Historial de cambios por tarifa.

### Verificación
Playwright sobre `/costeo/tarifas` con sesión autorizada: screenshot del hover de fila, del header de grupo con mini-resumen, y del empty state con filtros activos.
