# Tarifario de Pricing

## Qué vas a ver
Una pantalla **Tarifario** (en Costeo) con tres pestañas, filtros, búsqueda y botón **Descargar Excel**:

1. **Tarifas (Puertos base)**: Origen, Destino, Tipo de carga, Agente, Naviera, Tarifa 20" (USD), Tarifa 40" (USD), Inicio de vigencia, Término de vigencia, Días libres de demoras, Observaciones. Por defecto sólo vigentes (hoy entre inicio y término); interruptor para ver vencidas.
2. **Cargos FOB de agentes**: Agente, Monto, Currency, Unidad (aplican sólo cuando el incoterm es FOB).
3. **Concentrado de cargos locales en México para revalidación**: Naviera, Monto, Currency, Unidad.

## Quién puede llenarlo
Encargados de Pricing = quienes ya pueden responder solicitudes de pricing (rol Pricing) + administradores. Los demás sólo consultan y descargan.

## Dos formas de llenado
1. **Manual**: botones Nueva / Editar / Duplicar (para la nueva lista que mandan los proveedores cada ~15 días; la anterior queda como histórico, no se borra).
2. **Desde una respuesta de solicitud**: al responder, la tarifa pide Inicio y Término de vigencia. Si dura más de 1 día, aparece en el tarifario automáticamente; si dura 1 día o menos, se guarda sólo en la solicitud.

## Respuesta automática a solicitudes
- Al abrir una solicitud de pricing, se muestran **Opciones del tarifario** que coinciden con lo pedido: misma ruta (origen/destino), tipo y tamaño de contenedor, vigentes a la fecha tentativa de carga. Si el incoterm es FOB, se suman los cargos FOB del agente; se muestran los cargos locales de revalidación de la naviera.
- El solicitante (o Pricing) elige una opción y queda **guardada en la solicitud**, que pasa a Respondida sin esperar a Pricing.
- Si no hay coincidencia o se necesita algo especial, se envía a Pricing como hoy.

## Fuera de alcance
Sin importar archivos de proveedores, sin correos, sin cotización automática.

## Detalles técnicos
- **Reusar** `costeo_tarifas` (una fila por tipo de contenedor, con `vigente_desde/hasta`, `dias_libres_demoras`, `notas`, `solicitud_pricing_id`). La vista 1 agrupa 20GP/40GP-40HC de la misma ruta+agente+naviera+vigencia en una fila; editar guarda ambas filas en una sola RPC atómica.
- Migración aditiva: tablas `costeo_cargos_fob_agente` (org, agente_id, concepto, monto, moneda, unidad, vigencia opcional, soft-delete) y `costeo_cargos_locales_naviera` (org, naviera_id, concepto, monto, moneda, unidad, soft-delete). GRANT + RLS por organización; escritura sólo `_crm_es_pricing` / admin.
- Regla de >1 día en la base: las tarifas nacidas de solicitud con vigencia ≤1 día se excluyen del tarifario (filtro en la vista/consulta), sin borrar nada.
- RPC `crm_aplicar_tarifa_tarifario(solicitud_id, tarifa_id)` SECURITY INVOKER, idempotente: copia la tarifa (y cargos FOB/locales aplicables) a la solicitud, liga y marca respondida; candado de misma org y estado.
- RPC de coincidencias `crm_tarifario_coincidencias(solicitud_id)` SECURITY INVOKER.
- Frontend en `src/features/costeo/tarifario/` (componentes ≤200 líneas, paginación), exportación con el generador CSV/Excel existente, pestaña de opciones en el detalle de solicitud.
- Pruebas focalizadas (agrupación 20/40, regla >1 día, coincidencias, permisos) + `db:postcheck`; CI/RLS completos en GitHub Actions. Sin cambio de versión salvo autorización.
