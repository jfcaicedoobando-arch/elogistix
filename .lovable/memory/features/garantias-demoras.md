---
name: Garantías y Demoras automáticas
description: Auto-cálculo de garantías (control operativo) y demoras (costo + venta) por embarque desde el timeline
type: feature
---
Fase 4 — `12.74.0`.

**Garantías de contenedor (`embarque_garantias_contenedor`)**:
- Control operativo de depósitos reembolsables. NO son gasto ni venta.
- Trigger `crear_garantia_contenedor` (AFTER INSERT en `embarque_contenedores`) crea registro automáticamente: si la naviera tiene `tiene_carta_garantia` vigente → monto 0 y estado `liberado`; si no → monto = `costeo_navieras_condiciones.deposito_contenedor_usd` y estado `pendiente`.
- Estados: pendiente / depositado / liberado / retenido.
- UI: pestaña "Garantías" en detalle del embarque (`TabGarantias.tsx`).

**Demoras**:
- RPC `calcular_demoras_embarque(uuid)` SECURITY DEFINER.
- Días en puerto = min(evento "Descarga") → max(evento "Entrega") del timeline (eventos_embarque). Si faltan → `sin_eventos=true`.
- Días excedidos = max(0, días puerto − `costeo_navieras_condiciones.dias_libres_demoras_default`).
- Costo: tabulador `costeo_naviera_demoras_tarifa` (por naviera, escalonado). Venta: tabulador independiente `costeo_demoras_venta_tarifa` (por org, USD).
- Genera filas en `conceptos_costo` y `conceptos_venta` con `origen='demoras_auto'` y `contenedor_id` por contenedor del embarque. Borra previas con mismo origen antes de insertar (idempotente).
- Trigger en `embarques` AFTER UPDATE OF estado: si pasa a 'Entregado' llama el RPC.
- UI manual: `SeccionDemorasAuto.tsx` en TabCostos con botones "Recalcular" / "Eliminar auto".

**Nuevas columnas trazabilidad**:
- `conceptos_costo.origen` y `conceptos_venta.origen`: text NOT NULL DEFAULT 'manual', CHECK IN ('manual','demoras_auto','cotizacion','costeo_tarifa').
- Filas con `origen != 'manual'` son sobrescribibles por re-cálculo. UI debe advertirlo si se editan.

**Ruta nueva**: `/costeo/demoras-venta` (CRUD del tabulador propio).
