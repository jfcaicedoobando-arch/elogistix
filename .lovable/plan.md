

## Plan: Rediseñar indicadores de riesgo con enfoque profesional

El problema actual es que los dots de colores (rojo, ámbar, azul) son pequeños, crípticos y no comunican la gravedad de forma intuitiva. Un diseñador experto usaría un sistema visual más descriptivo y escaneable.

### Cambios en `src/pages/Operaciones.tsx`

**1. Reemplazar `SemaforoDots` (líneas 76-106) por `RiesgoIndicador`**

Nuevo diseño: en lugar de dots con números, usar píldoras/chips apiladas horizontalmente con ícono + texto corto. Cuando no hay riesgo, mostrar un chip verde "Sin riesgo". Cuando hay:
- **Crítico**: Chip rojo sólido con ícono `AlertTriangle` + "3 críticas"
- **En Puerto**: Chip ámbar outline con ícono `Anchor` + "2 en puerto"  
- **Por Arribar**: Chip azul outline suave con ícono `Ship` + "1 por arribar"

Solo se muestran los chips con count > 0. Esto es inmediatamente legible sin tooltip.

**2. Reemplazar `RiskBadge` (líneas 120-129) en la tabla de cargas en riesgo**

Nuevo diseño: badge con fondo sólido más contrastado y un ícono pequeño contextual (AlertTriangle para crítico, Anchor para en puerto, Ship para por arribar). El texto del nivel ya no necesita el dot circular diminuto.

**3. Actualizar la columna "Riesgo" en la tabla de operadores (línea 302)**

Renombrar header a "Estado de cargas" para que sea más descriptivo.

**4. KPI card de alertas (Bloque 1)**

En el KPI rojo de alertas, desglosar el subtítulo: "3 críticas · 2 en puerto" en lugar de solo el total.

### Resumen de archivos
- `src/pages/Operaciones.tsx` — Reescribir `SemaforoDots`, `RiskBadge`, ajustar header de tabla y KPI de alertas.

