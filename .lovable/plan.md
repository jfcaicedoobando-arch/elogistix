

## Reemplazar barra de progreso por indicador textual claro

**Problema**: La barra de progreso muestra "12 de 68" como una línea semi-llena con un porcentaje, lo cual no aporta valor al usuario — los números ya están visibles arriba.

**Solución**: Eliminar la barra de progreso y reemplazarla con un texto compacto tipo fracción `12 / 68 llegaron` que es más legible y directo. Esto simplifica la UI sin perder información.

### Cambios

**`src/pages/portal/PortalEmbarques.tsx`** — No aplica, el cambio es solo en dashboard.

**`src/components/dashboard/DashboardStatusCards.tsx`**
- Eliminar el bloque de `<Progress>` + porcentaje (líneas 156-167)
- Reemplazarlo con un texto tipo: `12 / 68 completados` en `text-xs text-muted-foreground` alineado a la derecha, solo si resulta útil como resumen — o simplemente eliminarlo ya que la info de "Ya llegaron" y "Total" ya está visible en las métricas de arriba.

**`src/pages/Changelog.tsx`** — Entrada v8.0.6

### Archivos a modificar
- `src/components/dashboard/DashboardStatusCards.tsx` (eliminar barra de progreso)
- `src/pages/Changelog.tsx`

