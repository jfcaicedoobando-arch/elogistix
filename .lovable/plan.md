# Auditoría visual — Tarifas marítimas

Revisé `/costeo/tarifas` en vista Agrupada con capturas a 1440px. Resumen de hallazgos y propuestas de mejora, ordenadas por impacto.

## Hallazgos

### 1. Jerarquía del header débil
- "Tarifas marítimas" + subtítulo + botón conviven con KPIs justo debajo sin separación visual clara.
- El botón **"Nueva(s) tarifa(s)"** está aislado a la derecha; el `(s)` se lee raro y rompe el ritmo.

### 2. KPIs con baja relación señal/ruido
- 4 tarjetas del mismo tamaño, mismo peso visual. "Rutas cubiertas: 4" es informativo pero no accionable y compite con los accionables (Vigentes, Por vencer, Pendientes).
- "Click para filtrar" aparece sólo en una tarjeta → inconsistente. Debería ser comportamiento parejo (hover + cursor pointer + chip "filtrado").
- El KPI **Pendientes: 0** se ve igual de prominente que los que tienen datos, ocupando espacio sin valor.

### 3. Barra de filtros muy alta y plana
- 5 controles en línea, todos del mismo ancho/peso. La búsqueda (la más usada) no destaca.
- No hay botón visible "Limpiar" cuando no hay chips activos → el usuario no sabe que puede limpiar antes de filtrar.
- Falta indicador "X resultados" cerca de los filtros.

### 4. Toggle Agrupada/Tabla poco visible
- El segmented control queda flotando solo a la derecha sobre el primer grupo, sin etiqueta ("Ver:") ni contador de resultados al lado.

### 5. Tarjetas de grupo: densidad y comparabilidad
- **Mejor** se destaca con fondo verde, pero el resto de filas se ven muy similares entre sí; cuesta comparar "Reemplazada" vs "Vigente vence en 5 d" de un vistazo.
- El **precio total** (USD 6,135.00) usa el mismo tamaño/peso que el flete y los recargos → debería ser el ancla visual de cada fila.
- La columna de precio no está alineada como columna real (al ser flex, los montos "bailan" entre filas con diferentes longitudes).
- El **delta vs. Mejor** (ej. "+ USD 554") no se muestra en cada fila, aunque es lo más útil para comparar.
- Los chips de cabecera ("3 tarifas", "2 agentes", "Mejor: USD 6,689") están todos en `secondary` → se confunden entre sí. La "Mejor" debería ser el chip dominante.
- El badge **Reemplazada** se ve igual de visible que **Vigente**; en realidad debería ir atenuada (es histórico).

### 6. Vigencia: dos formatos compitiendo
- "12/jun → 25/jul" + "vence en 30 d" en dos líneas dentro de la misma celda. Funciona, pero la línea de hint usa color condicional sólo en rojo/ámbar; en verde se ve gris/muted y pierde la señal positiva.
- Falta un mini-indicador visual de tiempo restante (barra o dot timeline) que ayude a escanear vencimientos sin leer.

### 7. Espaciado y "área muerta" debajo del listado
- Hay un gran vacío blanco bajo "Colapsar todos" (≈400px) porque la vista no llena el viewport ni hay paginación/empty padding controlado.
- "Colapsar todos" queda suelto a la derecha, sin par "Expandir todos".

### 8. Acciones por fila
- El kebab `⋮` es discreto (bien), pero no hay affordance hover sobre la fila completa (no cambia cursor, no resalta). Usuarios principiantes no descubren que es clickeable.

### 9. Consistencia tipográfica
- Nombres de agente en `text-base` (LONGSAIL) y naviera en `text-xs muted` (COSCO Shipping Lines) → bien, pero los CAPS de "SHENZHEN GOLDEN SHIPPING CO.,LTD" rompen el ritmo (largos all-caps). Sugerido title-case o truncate + tooltip.

### 10. Accesibilidad / detalles
- Color verde `bg-success/5` + texto verde sobre fila destacada tiene contraste limitado en algunos montos.
- Los chips `Mejor: USD 6,689.00` en el header del grupo usan `success` muy saturado: compite con la fila ganadora abajo (doble énfasis).
- Falta foco visible al tabular por filas.

## Propuesta de mejoras (priorizada)

**Fase A — Quick wins (1 PR)**
1. Hacer **precio total** el dominante de la fila: `text-lg font-semibold tabular-nums`, alineado a columna fija.
2. Mostrar **delta vs Mejor** (`+USD 554` ó `−USD 0`) en cada fila no-ganadora, en `text-xs`.
3. Atenuar filas **Reemplazada/Vencida** con `opacity-60` para que la mirada vaya a las vigentes.
4. Header del grupo: dejar solo un chip dominante (Mejor) + texto secundario "3 tarifas · 2 agentes" sin chip.
5. Renombrar botón a **"Nueva tarifa"** y mover el "+ múltiples rutas" como tip dentro del modal (ya existe el badge dinámico).

**Fase B — KPIs y filtros**
6. Convertir los 4 KPIs en una sola **barra de estado compacta** (1 fila de pills) con conteos clicables; reservar tarjetas grandes sólo si hay alertas.
7. Mover la **búsqueda** a ocupar 2 columnas y subirla a la altura del header; el resto de filtros como `Select` compactos.
8. Mostrar "**N resultados**" + botón "Limpiar" siempre visibles al lado del toggle Agrupada/Tabla.

**Fase C — Comparabilidad**
9. En vista Agrupada, alinear las 4 zonas (agente/naviera · flete/recargos · total · vigencia · estado · acciones) como **columnas fijas** dentro de cada card para que el ojo escanee verticalmente.
10. Añadir **mini-barra de vigencia** (días restantes) en cada fila vigente; verde/ámbar/rojo según umbral.
11. Indicador visual de "**dentro de X días sin tarifa vigente**" por ruta cubierta (alertar gaps).

**Fase D — Detalle**
12. Hover de fila con `bg-muted/40` + cursor pointer; click abre detalle/edit.
13. Botón "Expandir todos" junto a "Colapsar todos"; ambos a la izquierda.
14. Empty padding controlado para evitar 400px en blanco; o paginación de grupos si > N.

## Fuera de alcance
- Cambios en el modal de creación (ya rediseñado en v13.135.46).
- Cambios en backend / RPCs.

## Siguiente paso
Si apruebas, arrancaría con **Fase A** (cambios puramente visuales, sin tocar datos ni lógica) y te muestro screenshots antes de seguir con B–D.
