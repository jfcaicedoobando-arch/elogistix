

## Plan: Mostrar todos los campos juntos en SeccionMercanciaGeneral

### Cambio único en `src/components/cotizacion/SeccionMercanciaGeneral.tsx`

Eliminar la lógica condicional `esTerrestre` y mostrar siempre los 4 campos en un grid:
- Tipo de Unidad (texto libre)
- Peso (kg)
- Volumen (m³)
- Piezas

Grid de 4 columnas en desktop (`md:grid-cols-4`), 2 en tablet, 1 en mobile.

