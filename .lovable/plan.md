

## Cambios en Dashboard: Profit filtrado por mes + Tabla mes siguiente con facturación

### Resumen
1. **ProfitTable** -- Filtrar para mostrar solo embarques con ETA en el mes actual (los "arribos de este mes")
2. **EmbarquesActivosTable** -- Reemplazar por una tabla de embarques con ETA en el **mes siguiente**, con un resumen de facturación (facturas emitidas vs pendientes de esos embarques)

### Archivos a modificar (4)

**1. `src/hooks/useDashboardData.ts`**
- Nuevo `useMemo`: `profitArribosEsteMes` -- filtrar `profitPorEmbarque` donde ETA cae en el mes actual (reusar `inicioMes`/`finMes` existentes)
- Nuevo `useMemo`: `embarquesMesSiguiente` -- filtrar `embarquesConEstado` donde ETA cae en el mes siguiente, con profit adjunto
- Nueva query: traer facturas por `embarque_id` para los embarques del mes siguiente (o reusar datos existentes de `conceptos_venta`/`conceptos_costo` para el resumen)
- Nuevo `useMemo`: `resumenFacturacionMesSiguiente` -- agregar totales de venta USD, costo USD, profit, y conteos de embarques facturados vs pendientes (cruzando con tabla `facturas`)
- Exponer estos nuevos datos en el return

**2. `src/components/dashboard/ProfitTable.tsx`**
- Cambiar título a "Profit USD — Arribos este mes"
- Sin cambios de lógica, solo recibe datos ya filtrados

**3. `src/components/dashboard/EmbarquesActivosTable.tsx`**
- Renombrar/adaptar a mostrar embarques del mes siguiente
- Cambiar título a "Embarques — Próximo mes" con el nombre del mes
- Agregar resumen compacto arriba de la tabla: tarjetas inline con Total embarques, Venta USD proyectada, Costo USD, Profit proyectado, y cuántos ya tienen factura emitida
- Quitar la lógica de filtro por estado (ya no aplica) o mantenerla opcional
- Agregar columna "Facturado" (badge Sí/No basado en si existe factura para ese embarque)

**4. `src/pages/Dashboard.tsx`**
- Pasar `profitArribosEsteMes` a ProfitTable en vez de `profitPorEmbarque`
- Pasar nuevos datos del mes siguiente a EmbarquesActivosTable
- Quitar props de filtro de estado de EmbarquesActivosTable

### Datos nuevos necesarios
- Query de facturas agrupada por `embarque_id` para saber qué embarques ya tienen factura. Se puede hacer con una query ligera: `select embarque_id, estado, total, moneda from facturas`
- Cruzar en `useMemo` con los embarques del mes siguiente

### Diseño del resumen de facturación (arriba de la tabla mes siguiente)
```text
┌─────────────────────────────────────────────────────────┐
│ 📅 Abril 2026  │  12 embarques  │  Venta: $45,000 USD  │
│ Costo: $32,000 │  Profit: $13,000  │  4/12 facturados  │
└─────────────────────────────────────────────────────────┘
```

