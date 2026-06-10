
# Fase 4 — Garantías y Demoras automáticas

Versión: **12.74.0**

## Principios de diseño

- **Garantía de contenedor = depósito reembolsable.** No es gasto ni venta. Solo control operativo contra la naviera. Si la naviera tiene `carta_garantia = true` → monto esperado 0.
- **Demoras = gasto real + ingreso al cliente** con **dos tabuladores independientes** (costo naviera ya existe; agregamos tarifa propia al cliente).
- **Días en puerto** se calculan **del timeline existente** (`eventos_embarque`). Si faltan los eventos clave, no se calcula y se muestra advertencia.
- Auto al cerrar embarque (estado → "Entregado") **+** botón "Recalcular demoras" en pestaña Financiero.
- Todo escribe en `conceptos_costo` y `conceptos_venta` con `origen = 'demoras_auto'` para poder recalcular sin duplicar.

---

## A. Garantías de contenedor — solo control operativo

### Base de datos
- Nueva tabla `embarque_garantias_contenedor`:
  - `embarque_id`, `embarque_contenedor_id`, `naviera_id`, `monto_deposito_usd`, `tiene_carta_garantia` (snapshot al crear), `estado` (`pendiente` | `depositado` | `liberado` | `retenido`), `fecha_deposito`, `fecha_liberacion`, `notas`, `organization_id`, timestamps.
  - GRANT + RLS por organización.
- Trigger en `embarque_contenedores` AFTER INSERT: si la naviera del embarque no tiene carta de garantía, crear registro `pendiente` con el monto de `costeo_navieras_condiciones.deposito_contenedor_usd` (campo nuevo si no existe). Si tiene carta → registro con monto 0 y estado `liberado`.

### UI
- Nueva pestaña **"Garantías"** dentro del detalle de embarque (solo lectura para operadores; editable para finanzas).
- Tabla por contenedor: naviera, depósito, estado, fecha depósito/liberación.
- Acciones: marcar Depositado / Liberado / Retenido (con confirmación).
- **No** toca `conceptos_costo` ni `conceptos_venta`. Reporte separado de "Depósitos por recuperar" (fuera de scope esta fase).

---

## B. Demoras — auto en cierre + recálculo manual

### Base de datos
- Nueva tabla `costeo_demoras_venta_tarifa` (tabulador propio al cliente, espejo de `costeo_naviera_demoras_tarifa` pero **independiente**):
  - `id`, `tipo_contenedor`, `dia_desde`, `dia_hasta`, `monto_usd`, `vigente_desde`, `vigente_hasta`, `organization_id`, timestamps.
  - GRANT + RLS. UI mínima en `/costeo/demoras-venta` (lista + CRUD simple).
- `conceptos_costo` y `conceptos_venta`: agregar columnas `origen TEXT` (default 'manual') y `embarque_contenedor_id UUID NULL`. Permite identificar y recalcular sin duplicar.
- Función RPC `calcular_demoras_embarque(embarque_id)` SECURITY DEFINER que:
  1. Lee `eventos_embarque` y deriva por contenedor: `fecha_descarga` (evento "Descarga" o "Arribo") y `fecha_devolucion_vacio` (evento "Devolución de vacío"). Si falta cualquiera → retorna warning para ese contenedor.
  2. Calcula `dias_en_puerto = fecha_devolucion - fecha_descarga`.
  3. Obtiene `dias_libres_demoras` de la tarifa de costeo vigente (Top 1 para esa ruta/naviera/contenedor) o de override manual.
  4. `dias_excedidos = max(0, dias_en_puerto - dias_libres)`.
  5. Aplica el **tabulador de costo** (`costeo_naviera_demoras_tarifa`) tramo por tramo → genera/actualiza fila en `conceptos_costo` con `origen='demoras_auto'`.
  6. Aplica el **tabulador de venta** (`costeo_demoras_venta_tarifa`) tramo por tramo → genera/actualiza fila en `conceptos_venta` con `origen='demoras_auto'`.
  7. Devuelve JSON con desglose por contenedor (para preview UI).
- Trigger en `embarques` AFTER UPDATE: cuando `estado` cambia a `entregado`, llamar al RPC automáticamente.

### UI
- Pestaña Financiero (`TabFinanciero` del embarque): nueva sección **"Demoras"** arriba de los conceptos:
  - Muestra desglose por contenedor: días en puerto, días libres, días excedidos, costo, venta, margen.
  - Si faltan eventos → badge ámbar "Eventos incompletos" con link al timeline.
  - Botón **"Recalcular demoras"** → llama al RPC y refresca conceptos.
  - Botón secundario **"Eliminar demoras automáticas"** (borra solo filas con `origen='demoras_auto'`).
- Las filas con `origen='demoras_auto'` aparecen en `ResumenConceptosVenta` y `ResumenConceptosCosto` con badge "Auto" e ícono de candado parcial (editables pero advierten que el recálculo las sobrescribe).

---

## C. Archivos nuevos / editados

### Backend (3 migraciones)
1. `embarque_garantias_contenedor` + trigger + columna `deposito_contenedor_usd` en `costeo_navieras_condiciones`.
2. `costeo_demoras_venta_tarifa` + columnas `origen`/`embarque_contenedor_id` en `conceptos_costo`/`conceptos_venta`.
3. RPC `calcular_demoras_embarque` + trigger de cierre.

### Frontend
- `src/features/embarques/components/TabGarantias.tsx` (≤200 líneas).
- `src/features/embarques/components/financiero/SeccionDemorasAuto.tsx`.
- `src/features/embarques/hooks/useGarantiasContenedor.ts`, `useDemorasEmbarque.ts`.
- `src/features/embarques/services/garantias.ts`, `demorasEmbarque.ts`.
- `src/features/costeo/routes/CosteoDemorasVenta.tsx` + form/hook/service (CRUD simple del tabulador venta).
- Sidebar: nuevo item "Tarifa demoras (venta)" bajo Costeo.
- `EditarEmbarque.tsx`: registrar tab "Garantías".

### Types y rutas
- `src/features/embarques/types/garantia.ts`, `demoraDesglose.ts`.
- `appRoutes.tsx` + `appRoutes.lazy.ts` para `/costeo/demoras-venta`.

### Tests
- Unit del cálculo de demoras (escalonado, días excedidos = 0, eventos faltantes).
- Test del trigger de cierre (transición a `entregado` genera conceptos).

---

## D. Fuera de scope (Fase 5)

- Reporte "Depósitos por recuperar" (saldos por naviera).
- Re-facturación al cliente cuando se retiene una garantía.
- Importador Excel de tabuladores de demoras.
- Markup por cliente sobre demoras (decidimos tarifa propia única en Fase 4).
