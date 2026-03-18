

## Plan: Reporte de Rentabilidad por Cliente (P&L)

### Resumen

Nueva pagina `/reportes/rentabilidad` con tabla agrupada por cliente mostrando venta, costo, profit y margen acumulados de sus embarques, filtrable por rango de fechas y modo de transporte. Incluye grafica de barras Top 10 clientes por profit.

---

### 1. RPC server-side para agregacion

Crear una funcion RPC `profit_por_cliente` que agrupe `conceptos_venta` y `conceptos_costo` (en USD) por `cliente_id`/`cliente_nombre`, con filtros opcionales de rango de fechas (basado en `embarques.eta`) y modo de transporte. Retorna: `cliente_id`, `cliente_nombre`, `total_embarques`, `venta_usd`, `costo_usd`.

Esto evita traer todos los registros al cliente y resuelve el limite de 1000 filas.

**Migracion SQL necesaria.**

### 2. Hook `useRentabilidadClientes`

Nuevo archivo `src/hooks/useRentabilidadClientes.ts`:
- Acepta parametros: `fechaDesde`, `fechaHasta`, `modo` (opcional)
- Llama a la RPC `profit_por_cliente` con esos filtros
- Calcula `profit` y `margen` en el cliente con `calcularUtilidad` / `calcularMargen` de `financialUtils`
- Agrega query key en `queryKeys.ts` bajo `reportes.rentabilidadClientes`

### 3. Pagina `src/pages/Reportes.tsx`

Nueva pagina con:
- **Filtros**: Date range picker (fecha desde / hasta, default: mes actual), select de modo de transporte (Todos / Maritimo / Aereo / Terrestre)
- **4 KPI cards** arriba: Total Clientes con operaciones, Revenue total USD, Profit total USD, Margen promedio %
- **Tabla** con columnas: Cliente, Embarques, Venta USD, Costo USD, Profit USD, Margen % (con badge coloreado). Ordenable por profit. Click en fila navega a `/clientes/:id`
- **Grafica Top 10**: `BarChart` de Recharts (ya instalado) mostrando los 10 clientes con mayor profit. Usa `ChartContainer` existente
- Boton "Exportar CSV" reutilizando `exportToCsv`

### 4. Ruta y navegacion

- `App.tsx`: agregar ruta `/reportes/rentabilidad` con lazy load
- `AppSidebar.tsx`: agregar grupo "Reportes" entre Gestion y Directorio con entrada "Rentabilidad" (icono `BarChart3`)

### 5. Changelog

Entrada v5.24.0 — "Nuevo reporte de Rentabilidad por Cliente con P&L agrupado, filtros de fecha/modo, grafica Top 10 y exportacion CSV"

---

### Archivos

| Accion | Archivo |
|--------|---------|
| Migracion | Nueva RPC `profit_por_cliente` |
| Nuevo | `src/hooks/useRentabilidadClientes.ts` |
| Nuevo | `src/pages/Reportes.tsx` |
| Editar | `src/App.tsx` (ruta) |
| Editar | `src/components/AppSidebar.tsx` (nav) |
| Editar | `src/lib/queryKeys.ts` (key) |
| Editar | `src/pages/Changelog.tsx` |

