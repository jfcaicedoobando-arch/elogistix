## Objetivo
Ocultar las cards del dashboard del operador cuando no haya items en ellas (pendientes, docs faltantes, sin tracking).

## Cambios

### 1. `MiOperacionSection.tsx`
- Modificar `WidgetCard` para que cuando `count === 0` y no esté cargando, no renderice nada (retornar `null`).
- Esto hará que las 3 cards desaparezcan automáticamente cuando estén vacías.
- Si las 3 cards desaparecen, la sección "Mi operación" se verá vacía (solo quedaría el título); en ese caso, ocultar también el título de la sección cuando no haya nada que mostrar.

## Resultado esperado
- Dashboard del operador limpio: solo se ven las cards que tienen contenido relevante.
- Sin mensajes de "Sin pendientes hoy" / "Sin documentación pendiente" / "Tracking al día" ocupando espacio.
