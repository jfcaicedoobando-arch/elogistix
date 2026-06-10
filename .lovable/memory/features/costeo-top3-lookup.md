---
name: Costeo Top 3 Lookup
description: Vista Top 3 tarifas marítimas vigentes y lookup desde wizard de cotización
type: feature
---
Módulo Costeo Fase 3 (v12.73.0):

- **Editor `/costeo/tarifas`**: alta de tarifas en USD con recargos hijos dinámicos (BAF/LSS/ISPS/THC Origen/Otro). Filtros por estado, agente, contenedor. Acciones: duplicar (precarga form con vigente_desde=hoy), eliminar.
- **Reemplazo automático**: trigger `costeo_tarifas_marcar_reemplazadas` AFTER INSERT marca como `estado='reemplazada'` y setea `reemplazada_por=NEW.id` en todas las tarifas vigentes previas con misma (org, agente, ruta, tipo_contenedor) y `vigente_desde <= NEW.vigente_desde`. Histórico se conserva.
- **Vista `/costeo/buscar`**: filtros (origen CN, destino MX, contenedor, fecha) → llama RPC `get_top_tarifas` y renderiza 3 `TarifaResultCard` con desglose de recargos, badge carta garantía (verde/rojo/ámbar), demora día 6 USD, días crédito, días libres.
- **RPC `get_top_tarifas(origen, destino, contenedor, fecha, org?)`**: SECURITY DEFINER, valida membresía vía `organization_members`. Orden: `total_comparable ASC, dias_credito DESC NULLS LAST, dias_libres_demoras DESC NULLS LAST`. LIMIT 3.
- **Integración wizard cotización**: en `SeccionCostosInternosPLLocal` botón "Buscar tarifa Costeo" abre `BuscarTarifaDialog` (compartido). Al elegir, se llaman `fetchRecargosDeTarifa(id)` y se hacen append a `filas` USD: 1 fila flete base + N filas recargos (proveedor = agente, costo_unitario = precio_venta, notas con id de tarifa).
- **Trazabilidad**: `cotizacion_costos.costeo_tarifa_id` / `costeo_tarifa_recargo_id` (FK SET NULL) listas para persistencia futura (wizard local todavía no las usa).
- Todo en USD (sin CHECK constraint; `moneda: 'USD'` se fuerza en service insert).
