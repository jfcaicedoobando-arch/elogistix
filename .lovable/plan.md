

## Plan: Rediseño completo del Dashboard

### Enfoque de diseño
Dashboard moderno estilo "command center" con cards glassmorphism, indicadores visuales con gradientes, y micro-interacciones. Layout limpio con jerarquía visual clara.

### Datos
- `useEmbarques()` + `calcularEstadoEmbarque()` para estado real
- Query dedicada para conceptos_venta y conceptos_costo USD de embarques activos (batch query)
- Eliminar: facturas, gastos, recharts, BitacoraActividad, useActividadReciente

### Estructura del nuevo Dashboard

**1. Header con saludo contextual** (Buenos días/tardes/noches) + fecha actual

**2. Resumen por estado — 4 cards interactivas (clickables como filtro)**
- Confirmado / En Tránsito / En Aduana / Entregado
- Cada card: icono, conteo, barra de progreso proporcional, color distintivo
- Click → filtra la lista de embarques (sección 5)
- Card seleccionada con borde/glow del color correspondiente

**3. Alertas de demora — Card con lista**
- Embarques "En Aduana" donde `diasDesdeETA >= dias_libres_destino` (default 7)
- Días de demora = hoy - ETA - dias_libres_destino
- Ordenados desc por días demora
- Indicador visual rojo/naranja según severidad
- Click → navigate al embarque

**4. Próximos arribos 7 días — Card con timeline visual**
- Embarques "En Tránsito" con ETA entre hoy y +7 días
- Mini-cards con expediente, cliente, ETA, días restantes
- Ordenados por ETA asc
- Click → navigate al embarque

**5. Profit USD por embarque — Card con tabla compacta**
- Query batch: conceptos_venta y conceptos_costo filtrados por moneda USD
- profit = Σ venta USD - Σ costo USD
- % margen = profit / venta * 100
- Badge coloreado (verde >15%, amber >0%, rojo <0%)
- Click → navigate al embarque

**6. Lista de embarques activos — Tabla filtrable**
- Filtro conectado a las cards de estado (sección 2)
- Columnas: Expediente, Cliente, Modo (con emoji), Origen→Destino, ETD, ETA, Estado, Operador
- Click row → navigate al embarque

### Archivos a modificar

1. **`src/pages/Dashboard.tsx`** — Reescritura completa:
   - Imports: solo useEmbarques, calcularEstadoEmbarque, supabase, lucide icons, UI components
   - Hook useQuery para conceptos_venta + conceptos_costo USD en batch
   - useMemo para calcular estados reales, alertas demora, próximos arribos, profit
   - useState para filtro de estado activo
   - Layout: grid responsivo con las 5 secciones

2. **`src/pages/Changelog.tsx`** — Entrada v4.16.0 (minor): "Rediseño completo del Dashboard"

### Paleta de colores por estado
- Confirmado: azul (info)
- En Tránsito: amber (warning)  
- En Aduana: naranja/rojo
- Entregado: verde (success)

### Detalle técnico: Query de profit
```typescript
// Batch query para todos los conceptos USD
const { data: ventasUSD } = useQuery({
  queryKey: ['dashboard-ventas-usd'],
  queryFn: async () => {
    const { data } = await supabase
      .from('conceptos_venta')
      .select('embarque_id, total')
      .eq('moneda', 'USD');
    return data ?? [];
  }
});
// Similar para conceptos_costo con .eq('moneda', 'USD')
```

Luego se agrupa por embarque_id con reduce para calcular profit por embarque.

