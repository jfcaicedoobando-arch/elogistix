
## Expandir src/pages/Reportes.tsx — Dashboard completo (v4.31.0)

### Arquitectura de datos

**Período seleccionado** — estado local `useState<'mes' | 'trimestre' | 'año'>('mes')` con función helper `getFechaInicio(periodo)` que devuelve un `Date`.

**Datos necesarios (todos client-side, ya descargados):**
- `useEmbarques()` — todos los embarques (ya existe)
- `useClientes()` — para rentabilidad cliente (ya existe)
- `useAllConceptos()` — conceptos_venta + conceptos_costo (ya existe)
- Nuevo hook `useAllCotizaciones()` — query a `cotizaciones` con columnas: `id, folio, estado, operador, modo, created_at` (solo lo necesario para métricas de ventas)

**Eliminar**: `useFacturas`, `useGastosPendientes` y sus imports.

---

### Filtro global de período

```text
Header
┌────────────────────────────────────────────────────────────┐
│ Reportes                    [Este mes] [Último trimestre] [Este año] │
└────────────────────────────────────────────────────────────┘
```

Botones tipo `Button variant="outline"` / `"default"` según selección activa. Afecta todas las secciones excepto las dos existentes (Rentabilidad por Cliente y Top Clientes — trabajan sobre todos los datos siempre).

---

### Secciones a agregar

**1. Panorama General — 4 KPI cards** (grid 4 cols en lg, 2 en sm)

| KPI | Fuente |
|---|---|
| Embarques activos | embarques filtrados por período, excluyendo Entregado/Cerrado/Cancelado |
| Profit total USD | sum(conceptos_venta en USD) - sum(conceptos_costo en USD) de embarques del período |
| Cotizaciones creadas | cotizaciones filtradas por created_at en período |
| Tasa de conversión | cotizaciones Aceptada / total * 100 del período |

**2. Sección Operaciones** (nueva)

- BarChart horizontal: embarques por estado (Confirmado, En Tránsito, En Aduana, Entregado, etc.)
- BarChart: embarques por modo (Marítimo, Aéreo, Terrestre) — reemplaza el PieChart existente **solo en la nueva sección; el PieChart actual se mantiene donde está**
- Tabla top 5 demoras: embarques donde estado = "En Aduana" y `diffDays(today, eta) > 7`, columnas: Expediente, Cliente, ETA, Días demora

**3. Sección Ventas** (nueva)

- LineChart: cotizaciones por mes últimos 6 meses (independiente del filtro)
- Tabla: cotizaciones por estado (Borrador, Enviada, Aceptada, Rechazada, Convertida) con conteo y % del total del período
- Tabla: top 5 operadores por cotizaciones Aceptada en el período

**4. Sección Rentabilidad** (nueva)

- BarChart: profit USD por mes últimos 6 meses (suma de ventas USD - costos USD por mes de embarque created_at)
- Tabla: profit por modo de transporte con margen %
- Card destacada: margen promedio del período (en %)

---

### Diseño

- `bg-slate-50` como fondo de la página (wrapper div)
- Cards con `rounded-2xl shadow-sm border-0 bg-white`
- Números positivos: `text-emerald-600`, negativos: `text-red-500`
- Separadores de sección con título + badge de count
- Skeletons durante loading
- Importar `LineChart, Line` de recharts (ya está como dependencia)

---

### Archivos a modificar

1. **`src/pages/Reportes.tsx`** — reescritura completa expandida manteniendo las dos secciones originales
2. **`src/lib/queryKeys.ts`** — agregar `reportes.cotizaciones` key
3. **`src/pages/Changelog.tsx`** — entrada v4.31.0

---

### Lógica de filtrado por período

```typescript
function getFechaInicio(periodo: string): Date {
  const hoy = new Date();
  if (periodo === 'mes') return new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  if (periodo === 'trimestre') return new Date(hoy.getFullYear(), hoy.getMonth() - 2, 1);
  return new Date(hoy.getFullYear(), 0, 1); // año
}
```

El filtrado se hace client-side comparando `created_at >= fechaInicio`.

---

### Secciones existentes intocadas

- **Gráfica "Rentabilidad por Cliente (MXN)"** — permanece igual, sin filtro de período
- **Tabla "Top Clientes por Volumen e Ingresos"** — permanece igual, sin filtro de período

Ambas se mueven al final de la página, en su sección "Rentabilidad por Cliente" actual.
