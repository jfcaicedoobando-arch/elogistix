

## Plan: Quitar el cuadro "Top del mes"

Eliminar la card oscura "Top del mes" (líneas 384-409) y hacer que la tabla de operadores ocupe todo el ancho.

### Cambios en `src/pages/Operaciones.tsx`

1. **Línea 281**: Cambiar el grid de `xl:grid-cols-4` a solo un contenedor sin grid (ya no hay sidebar).
2. **Línea 282**: Quitar `xl:col-span-3` de la card de ranking.
3. **Líneas 384-409**: Eliminar completamente la card "Top del mes".
4. Eliminar la variable `topOperador` si ya no se usa en ningún otro lugar.

