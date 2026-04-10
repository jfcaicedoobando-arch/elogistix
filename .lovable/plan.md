

## Mostrar contenedor en la lista de embarques del portal

**Problema**: Cuando un expediente tiene múltiples contenedores, las tarjetas se ven idénticas y el cliente no sabe diferenciarlas.

**Solución**: Mostrar el número de contenedor en cada tarjeta de embarque del portal.

### Cambio en `src/pages/portal/PortalEmbarques.tsx`

1. **Agregar `contenedor` al query** en `usePortalEmbarques` (`src/hooks/usePortalData.ts`) — añadir el campo `contenedor` al `.select()`

2. **Mostrar el contenedor en la tarjeta** — debajo de la ruta (origen → destino), agregar una línea que muestre el número de contenedor cuando exista:
   ```
   📦 WHSU5494746
   ```
   Usar un icono `Package` de Lucide con el texto del contenedor en `text-[10px]`, junto a los campos ETD/ETA existentes.

3. **Incluir contenedor en la búsqueda** — agregar `e.contenedor` al filtro de búsqueda para que el cliente pueda buscar por número de contenedor.

### Cambio en `src/pages/Changelog.tsx`
- Agregar entrada v8.0.4 con la mejora.

### Archivos a modificar
- `src/hooks/usePortalData.ts`: agregar `contenedor` al select de `usePortalEmbarques`
- `src/pages/portal/PortalEmbarques.tsx`: mostrar contenedor en tarjeta + incluir en búsqueda
- `src/pages/Changelog.tsx`: nueva entrada

