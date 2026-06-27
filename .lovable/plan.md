## Auditoría visual UI/UX a 1920 × 1080

Capturé 17 vistas clave del producto en resolución Full HD (1920 × 1080) con la sesión real del usuario admin y revisé bugs visuales, jerarquía, espacios y bordes. La consola está limpia (sólo warnings de React Router v7 future flags, no son visuales).

A continuación resumo los hallazgos por severidad y propongo el alcance de la siguiente iteración (sólo UI/presentación, sin tocar lógica de negocio).

---

### 🔴 Alta prioridad (bugs visuales claros)

1. **Embarques → tab `Demoras y Garantías` · tabla "Demoras por contenedor"**
   La columna **"Días libres (override)"** muestra el texto `naviera` como si fuera un valor escrito; en realidad es el placeholder del input. Se confunde con un valor cargado.
   *Fix:* placeholder con estilo `text-muted-foreground italic`, prefijo "ej. usa naviera" o icono ⓘ.

2. **Embarques → tab `P&L` · card "Margen real"**
   Muestra `0.0%` en color azul cuando la utilidad real es **-$49,774** y los demás KPIs ya marcan -100%. Inconsistencia visual peligrosa (usuario podría leer "todo bien").
   *Fix:* mismo cálculo/color que `Utilidad real`; tono `destructive` cuando margen < 0.

3. **Facturación (lista) · KPIs superiores**
   Las sparklines de "FACTURADO" y "COBRADO" se superponen con las etiquetas `E F M A M J` y los puntos verdes/grises se ven cortados. En 1920px hay espacio de sobra para separarlos.
   *Fix:* aumentar altura del card y dar `padding-right` al sparkline.

4. **Embarque detalle · header de chips**
   `ELIMP00154` + chip `EIR` (negro) + ícono ⚓ suelto + chip verde `PROFORMA GENERADA` + chip ámbar `Admin pendiente · 2` mezclan tres formas y un ícono huérfano. Visualmente desordenado.
   *Fix:* unificar a chips con la misma altura/border-radius; envolver el ícono ⚓ dentro de un chip "Modo: Marítimo" o moverlo a la metadata inferior.

5. **Cierre · botón `Cerrar embarque` deshabilitado**
   No comunica por qué (hay 3 pendientes en el checklist arriba, pero el botón sólo se ve gris).
   *Fix:* `Tooltip` con motivo ("Faltan 3 pendientes del checklist") o leyenda en línea.

---

### 🟡 Media prioridad (jerarquía y densidad en 1920px)

6. **Compras → Resumen**, **Conciliación**, **Configuración → Empresa**, **Tarifas marítimas (grupo vacío)**
   Mucho whitespace bajo el contenido en 1920×1080 (la página termina a ~50% del alto). Conciliación usa 4 cards full-width sobre una tabla de 5 filas → se siente diluido.
   *Fix:* contenedor con `max-w-screen-2xl mx-auto` consistente, o repartir KPIs + tabla en grid 2 columnas cuando la altura lo permita.

7. **Usuarios → tabla `Internos`**
   La columna **"Cambiar rol"** repite literalmente el badge `ROL` (el select muestra el mismo texto que el chip de al lado). Además el select ocupa casi 1/3 del ancho.
   *Fix:* mostrar el select **sólo** al pasar el mouse (icono ✎) o convertir el chip de la columna `ROL` en un select inline; eliminar la columna duplicada.

8. **Dashboard · "Cargas activas por cliente"**
   En 1920px la barra de progreso y el `75% del total` quedan flotando muy a la derecha, separados del nombre del cliente por un océano vacío.
   *Fix:* limitar el ancho de la barra (`max-w-[480px]`) y agrupar con el porcentaje al lado del cliente.

9. **Dashboard · timeline de estados (Confirmado → Entregado)**
   Las líneas conectoras entre los 5 nodos quedan muy largas a 1920px y los nodos parecen islas.
   *Fix:* `max-w-4xl mx-auto` para el timeline o grosor mayor en la línea.

10. **Embarques (lista) · columnas ETD/ETA/Modo**
    `Modo` + icono pequeño quedan apretados; los badges `Datos pendientes` empujan la columna BL Master.
    *Fix:* `min-w` por columna y truncate con tooltip en BL Master.

11. **Header global**
    Toda la zona central de la topbar está vacía (1280px sin contenido), sólo se ve el breadcrumb a la izquierda y los íconos a la derecha.
    *Fix:* mover el buscador `⌘K` al centro o mostrar breadcrumb expandido.

---

### 🟢 Baja prioridad (pulido)

12. **Cotizaciones · header de columna "Subtotal"**
    El icono de orden colisiona con el `text-right`, queda apretado contra "USD 7,584.02".

13. **Auditoría operativa · card "Tendencia 30 días"**
    Card vacío con sólo texto descriptivo ocupa el mismo tamaño que el card lleno de la izquierda → desequilibrio visual.

14. **Sidebar · footer**
    `v13.139.5` muy discreto; no hay separador con el menú del usuario.

15. **Embarques → tab Facturación · cards "Pendiente / En proforma / Facturado"**
    Las cards alternan border-color (verde, azul, gris) pero el contraste de "En proforma" (azul claro) y "Facturado" (verde claro) es bajo en light mode.

---

### Alcance propuesto para la implementación

Si apruebas, procedo en **build mode** con los siguientes lotes:

```text
Lote 1 — Bugs visuales (🔴 1–5)
  · Demoras override placeholder
  · P&L margen color/coherencia
  · Facturación sparkline overlap
  · Embarque header chips uniformes
  · Cierre tooltip de bloqueo

Lote 2 — Densidad y jerarquía (🟡 6–11)
  · Containers max-w consistentes
  · Tabla Usuarios sin columna duplicada
  · Dashboard barras y timeline acotados
  · Topbar con buscador centrado

Lote 3 — Pulido (🟢 12–15)
  · Headers de tabla con orden
  · Auditoría layout balanceado
  · Sidebar footer
  · Contraste cards facturación
```

Cada lote bumpea versión patch (`13.139.x`) y actualiza `CHANGELOG.md`.

### Detalles técnicos

- Sólo se tocan archivos de presentación (`*.tsx` de componentes/features) y tokens CSS si hace falta ajustar contraste; **no se modifica RPC, services ni hooks de datos**.
- Las capturas quedan en `/tmp/browser/audit/screenshots/` por si quieres revisarlas; puedo adjuntarlas en una captura específica si me pides un hallazgo en detalle.
- No se detectaron errores de runtime, sólo warnings de React Router v7 (no son bloqueantes y están pinneados por la plataforma Lovable, ver `mem://constraint/lovable-stack-pins`).

### Pregunta

¿Avanzo con los **3 lotes en orden** o prefieres que arranque sólo con el **Lote 1 (bugs 🔴)** y luego decidimos?
