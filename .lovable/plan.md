## Problemas detectados en el card "Embarques — [Mes]"

Tras inspeccionar el componente `EmbarquesActivosTable.tsx`, el parser `parseResumenMesSiguiente` y la función SQL `dashboard_details()`:

1. **Resumen vacío**: la RPC nunca devuelve la clave `resumenMesSiguiente`, por lo que las 5 tarjetas (Embarques, Venta USD, Costo USD, Profit, Facturados) muestran 0 / $0 y el título queda como `Embarques —` (sin nombre de mes).
2. **Profit en NaN**: las filas devuelven `ventaUSD` y `costoUSD`, pero no `profit` ni `margen`. La columna "Profit" lee `e.profit` → resulta indefinido y se muestra como `$NaN`.
3. **Facturado siempre "No"**: la RPC no incluye el campo `facturado`. La tabla siempre lo pinta en gris.
4. **Título poco descriptivo**: solo dice "Embarques — Mayo" sin año ni contexto de "próximo mes".
5. **Layout apretado en tablets/móviles** (viewport actual 742px): el grid de 5 tarjetas en `sm:grid-cols-5` corta las cifras y la barra de "Facturados" queda comprimida.

## Cambios a implementar

### 1. Backend (RPC `dashboard_details`)
Agregar al JSON de salida la clave `resumenMesSiguiente` y, en cada fila de `mes_sig`, los campos `profit`, `margen` y `facturado`:

- `facturado` se determina con `EXISTS (SELECT 1 FROM facturas f WHERE f.embarque_id = eb.id AND f.estado <> 'Cancelada')`.
- `resumenMesSiguiente`:
  - `totalEmbarques`: count de mes_sig_src
  - `ventaUSD`, `costoUSD`, `profitUSD`: sumas
  - `facturados`: count con factura existente
  - `nombreMes`: `to_char(v_inicio_sig, 'TMMonth YYYY')` con locale `es_MX`
- Mismos campos también en `dashboard_stats()` por consistencia (ya replicamos patrón).

### 2. Parser (`src/lib/parsers/dashboard.ts`)
- Extender `EmbarqueMesSiguiente` parser para mapear `profit` y `margen` calculándolos en cliente como fallback (`venta - costo`, `(profit/venta)*100`) si la RPC no los envía aún.
- `parseResumenMesSiguiente` ya maneja todos los campos; solo confirmar fallback `nombreMes`.

### 3. UI (`EmbarquesActivosTable.tsx`)
- Título: `Embarques activos — próximo mes ({nombreMes})` capitalizado.
- Subtítulo aclaratorio: rango de fechas del próximo mes.
- Layout responsive del bloque de resumen:
  - `grid-cols-2 md:grid-cols-3 lg:grid-cols-5` (en 742px serán 2 columnas, ya no se cortan).
  - Tarjeta "Facturados" en formato vertical con progress bar debajo, igual ancho que las demás.
- Columna Profit: usar `e.profit ?? (e.ventaUSD - e.costoUSD)` para no mostrar NaN.
- Mejorar mensaje vacío: "Sin embarques con ETA en {nombreMes}".

### 4. Changelog
Agregar entrada **v8.99.11 — Fix card "Embarques — próximo mes"** en `src/content/changelog/v8/chunks/0.ts` describiendo los 4 fixes.

## Verificación post-cambio
- Ejecutar `dashboard_details()` y confirmar que `resumenMesSiguiente` y `facturado` aparecen.
- Abrir el dashboard en viewport 742px y validar que las 5 tarjetas se ven completas (sin truncar cifras), el título muestra mes+año, profit calcula correctamente y al menos algún embarque aparece como "Sí" facturado.
