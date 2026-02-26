

# Proveedores con pestañas por tipo

## Cambios

**`src/data/types.ts`:**
- Actualizar `TipoProveedor` para incluir los nuevos tipos: `'Naviera' | 'Aerolínea' | 'Transportista' | 'Agente Aduanal' | 'Agente de Carga' | 'Aseguradora'` (reemplaza `'Terminal'`, agrega `'Agente de Carga'` y `'Aseguradora'`)

**`src/data/mockData.ts`:**
- Agregar proveedores mock para los nuevos tipos (Agente de Carga, Aseguradora)
- Actualizar proveedores existentes de tipo `'Terminal'` si los hay

**`src/pages/Proveedores.tsx`:**
- Reemplazar el layout actual (filtro por Select + tabla única) con un componente `Tabs` de 6 pestañas: Navieras, Aerolíneas, Transportistas, Agentes Aduanales, Agentes de Carga, Aseguradoras
- Cada pestaña muestra solo los proveedores de ese tipo, con su buscador y tabla
- Mantener el panel lateral de detalle al seleccionar un proveedor
- Eliminar el filtro de tipo (ya no es necesario, las pestañas lo reemplazan)

## Pasos de implementación

1. Actualizar `TipoProveedor` en types.ts
2. Agregar proveedores mock para nuevos tipos
3. Refactorizar `Proveedores.tsx` con `Tabs` por tipo de proveedor

