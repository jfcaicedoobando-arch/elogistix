

## Linea de tiempo + Indicador de arribos y profit

### Archivos a modificar (3)

**1. `src/hooks/useDashboardData.ts`**
- Cambiar `arribosEsteMes` de `number` a objeto `{ total, yaLlegaron, enCamino, profitUSD }`:
  - Filtrar `embarquesConEstado` por ETA dentro del mes actual
  - `yaLlegaron`: filtrar por estadoReal in [Arribo, En Aduana, Entregado, EIR, Cerrado]
  - `enCamino`: filtrar por estadoReal in [Confirmado, En Tránsito]
  - `profitUSD`: sumar profit de esos embarques usando los maps de `ventasUSD`/`costosUSD` ya cargados
- Depende de `ventasUSD` y `costosUSD` en el `useMemo`

**2. `src/components/dashboard/DashboardStatusCards.tsx`** -- Reescribir
- **Timeline horizontal**: Un solo `Card` con 5 nodos conectados por lineas. Cada nodo:
  - Circulo con icono coloreado (de `estadoConfig`), conteo debajo, label
  - Lineas conectoras degradadas entre nodos
  - Click filtra (toggle), nodo seleccionado con ring/glow
  - En mobile: scroll horizontal con `overflow-x-auto`
- **Indicador de arribos + profit debajo**: Un `Card` compacto con:
  - 3 metricas: Total arribos | Ya llegaron | En camino
  - Profit USD proyectado con formato moneda
  - Barra de progreso `yaLlegaron / total`

**3. `src/pages/Dashboard.tsx`**
- Actualizar props pasadas a `DashboardStatusCards` (el objeto `arribosEsteMes` ahora trae `total`, `yaLlegaron`, `enCamino`, `profitUSD`)

