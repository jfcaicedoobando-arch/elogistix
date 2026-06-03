## Objetivo
En el módulo de Auditoría, pestaña Hallazgos, el botón "Abrir" de cada fila debe abrir el embarque en una nueva pestaña del navegador en lugar de navegar en la pestaña actual.

## Cambio técnico
**Archivo:** `src/components/auditoria/HallazgoTabla.tsx`

1. Reemplazar el `<Button>` con `onClick={() => navigate(...)}` por un `<Button asChild>` que contenga un `<a>` con:
   - `href` con la URL del embarque (incluyendo el tab query param según la regla)
   - `target="_blank"`
   - `rel="noopener noreferrer"`
   - `onClick={(e) => e.stopPropagation()}` para preservar el bloqueo del click en la fila

2. Remover el import de `useNavigate` de `react-router-dom` y su uso en el componente, ya que ya no será necesario.

## Resultado esperado
Al hacer clic en "Abrir" en cualquier hallazgo, el detalle del embarque se abre en una nueva pestaña del navegador manteniendo la vista actual de auditoría abierta.