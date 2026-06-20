## Estado del plan original "Revalidación de tarifa + Reconciliación"

### Implementado


| Pieza                                                                                                | Estado                            |
| ---------------------------------------------------------------------------------------------------- | --------------------------------- |
| DB: columnas `tarifa_id_original/aplicada/decision/delta_jsonb/revalidada_*` en `embarques`          | ✅                                 |
| DB: `estado_revalidacion` + campos en `cotizaciones`                                                 | ✅                                 |
| RPC `revalidar_tarifa_cotizacion`                                                                    | ✅                                 |
| RPC `crear_embarque_borrador_desde_cotizacion(p_decision,…)` con persistencia de decisión + bitácora | ✅                                 |
| RPC `solicitar_reaprobacion_tarifa` (+ notificación interna al operador)                             | ✅                                 |
| RPC `resolver_reaprobacion_tarifa`                                                                   | ✅                                 |
| Configuración `tarifa_revalidacion_umbral_pct` + `tarifa_revalidacion_bloquea_si_vencida`            | ✅                                 |
| Servicio `revalidacion/index.ts` + hook `useRevalidacionTarifa`                                      | ✅                                 |
| `RevalidarTarifaModal` (componente)                                                                  | ✅ creado, ❌ NO integrado al flujo |
| `ReaprobacionTarifaBanner` en `CotizacionDetalle`                                                    | ✅                                 |
| Tests unitarios de delta + modal                                                                     | ✅                                 |
| **Fase 2 extra:** Versionado (`recotizar_cotizacion`, `aceptar_cotizacion_version`, histórico)       | ✅                                 |
| **Fase 2 extra:** Reconciliación 3 columnas (Cotizado/Refrescado/Real) + UI                          | ✅                                 |
| Umbrales por organización (`/configuracion → Operaciones`)                                           | ✅                                 |


### Pendiente del plan original

1. **Integrar `RevalidarTarifaModal` en el flujo "Crear embarque"**
  - Hoy `useCotizacionConversions` / `CotizacionDetalleSecciones` llaman directo a `crearEmbarqueBorradorDesdeCotizacion` sin pasar por el modal.
  - Falta: interceptar el botón, llamar `revalidar_tarifa_cotizacion`, abrir modal según severidad (`sin_cambios` → continuar; `informativa` → modal con opciones mantener/refrescar/sustituir; `bloqueante` → forzar "Solicitar re-aprobación").
  - El modal ya recibe la decisión; sólo falta cablearla a la RPC sobrecargada con `p_decision`, `p_tarifa_id_aplicada`, `p_delta_jsonb`.
2. **Opción "Elegir otra tarifa" dentro del modal**
  - Reabrir `BuscarTarifaDialog` desde `RevalidarTarifaModal` cuando operaciones quiera sustituir la tarifa. Hoy el modal sólo soporta mantener/refrescar/solicitar reaprobación.
3. **Acciones del banner de re-aprobación que disparen efectos completos**
  - "Re-cotizar con tarifa vigente" debe **actualizar `conceptos_venta` y `cotizacion_costos**` desde la tarifa vigente y **regenerar el PDF / marcar para reenvío al cliente**. Hoy `resolver_reaprobacion_tarifa` sólo cambia el estado; no refresca conceptos ni dispara PDF.
  - "Mantener precio al cliente" → ya marca `reaprobada`; falta verificar que el flujo de conversión lea ese estado para permitir crear el embarque con `decision = 'reaprobada_ventas'`.
4. **Badges en lista de cotizaciones**
  - `⚠ Tarifa vencida` / `⚠ Precio cambió` en columnas de cotizaciones aceptadas. No existe (sólo hay banner de "cotización inactiva", que es distinto).
5. **Widgets en dashboards**
  - Dashboard de **operaciones**: contador "Cotizaciones aceptadas con tarifa desactualizada".
  - Dashboard **comercial**: contador "Cotizaciones esperando mi re-aprobación" (`estado_revalidacion = 'pendiente_reaprobacion'` filtrado por `operador = auth.uid()`).
6. **Sección "Origen de costos" en detalle de embarque**
  - Mostrar `tarifa_id_original` vs `tarifa_id_aplicada`, `tarifa_decision` (con badge) y el histórico de decisiones / delta. No existe en `EmbarqueDetalle`.
7. **Tarifa pestaña Conciliación (lo que mencionas)**
  - La pestaña Conciliación HOY tiene dos secciones:
    - **Reconciliación 3 columnas** (Cotizado → Refrescado → Real) — ya usa la versión **aceptada** de la cotización como columna Cotizado. ✅ Correcto para "ver desviación de lo cotizado contra el real".
    - **Cotizado vs Real por concepto (facturas proveedor)** — la tabla original.
  - **Pendiente menor**: cuando un embarque tenga `tarifa_decision != 'sin_cambios'`, mostrar en la pestaña un sub-encabezado tipo *"Se aplicó decisión: Refrescada / Sustituida / Reaprobada por ventas — ver Origen"* para que quede claro de dónde sale cada columna.

### Recomendación de orden (lo que más valor entrega primero)

1. **(7)** Sub-encabezado en pestaña Conciliación con la decisión aplicada — 15 min, alta claridad.
2. **(1) + (2)** Cablear `RevalidarTarifaModal` al botón "Crear embarque" — cierra el flujo principal del plan.
3. **(6)** Sección "Origen de costos" en `EmbarqueDetalle` — trazabilidad visible.
4. **(3)** Hacer que "Re-cotizar con tarifa vigente" realmente refresque costos/PDF.
5. **(4)** Badges en lista de cotizaciones.
6. **(5)** Widgets de conteo en dashboards.

¿Quieres que ataque los 6 puntos en ese orden en una sola tanda, o sólo el bloque crítico (1+2+6+7) y dejamos badges/dashboards para otra iteración? Todos los puntos