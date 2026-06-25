# Fase B — KPIs compactos y filtros optimizados

Continúo el rediseño visual de `/costeo/tarifas`. Esta fase ataca dos áreas que aún consumen mucho espacio vertical y compiten con la tabla.

## 1. KPIs más compactos (la tira de 4 tarjetas)

Hoy las 4 tarjetas (Vigentes hoy, Por vencer ≤7 días, Pendientes aprobación, Rutas cubiertas) ocupan ~120 px de alto cada una con íconos grandes en círculo. Propuesta:

- Reducir altura a ~56 px (una sola fila de chips/tiles).
- Ícono pequeño a la izquierda, número grande, etiqueta secundaria abajo.
- Mantener clicabilidad (siguen siendo atajos de filtro).
- Indicador visual claro cuando un KPI está "activo" como filtro (borde + fondo accent suave).
- "Rutas cubiertas" pasa a ser informativo (no clicable), diferenciado visualmente.

Resultado: el bloque de KPIs baja de ~140 px a ~70 px, dejando la tabla mucho más visible al cargar.

## 2. Barra de filtros optimizada

Hoy: 5 campos en una sola fila (Búsqueda, Aprobación, Vigencia, Agente, Contenedor) dentro de una `Card` con padding generoso.

Propuesta:

- Quitar el `Card` wrapper — la barra vive directo sobre el fondo.
- Búsqueda toma más ancho (es la acción principal) con ícono de lupa más prominente y placeholder mejor: "Buscar por puerto, agente o naviera…".
- Los 4 selects se compactan a tamaño `sm` con labels inline.
- Botón "Limpiar filtros" se mueve a la derecha de la fila, sólo visible cuando hay filtros activos.
- Chips de filtros activos (que ya existen) se mantienen debajo.

## 3. Detalles finos

- Espaciado vertical entre KPIs → filtros → toggle vista → tabla: usar `space-y-4` consistente.
- El toggle Agrupada/Tabla se alinea a la derecha en la misma fila que un contador "X tarifas" a la izquierda, para dar contexto.

## Archivos a modificar

- `src/features/costeo/routes/CosteoTarifas.tsx` — reestructura layout, KPIs, filtros, fila de contexto.
- Posiblemente extraer `TarifasKpiStrip.tsx` y `TarifasFilterBar.tsx` si el archivo crece (cumplimiento Power-of-10 ≤200 líneas).
- `CHANGELOG.md` + `APP_VERSION` → bump a `13.135.52`.

## Lo que NO se toca en esta fase

- Vista agrupada / tabla interna (eso es Fase C).
- Lógica de queries, RPCs, permisos.
- Estados de hover masivos / expansión global (Fase D).

¿Procedo con esta Fase B tal cual, o quieres ajustar algo antes (por ejemplo, conservar el `Card` de filtros, o mantener KPIs con su altura actual)? procede con la fase actual