

# Análisis: Automatización del Tracking

## Estado Actual

La pestaña "Tracking" en el detalle del embarque (`TabTracking.tsx`) solo permite **registro manual** de eventos. El operador selecciona tipo, fecha, ubicación y descripción. No hay ningún mecanismo automático.

## Opciones de Mejora

### Opción A: Eventos Automáticos por Cambio de Estado (Esfuerzo Bajo)

Cada vez que un operador avanza el estado del embarque (Confirmado → En Tránsito → Arribo, etc.) o cuando el sistema auto-calcula el estado basado en ETD/ETA, se inserta automáticamente un evento en `eventos_embarque` con:
- Tipo mapeado al estado (ej: "En Tránsito" → evento "Zarpe", "Arribo" → evento "Arribo a Puerto")
- Fecha del momento de la transición
- Usuario que realizó el cambio
- Descripción generada ("Estado cambiado a En Tránsito")

Esto se implementaría en `useEmbarqueMutations.ts` dentro de `useAvanzarEstadoEmbarque` y en `useSyncEstadoEmbarque`, insertando el evento junto con el cambio de estado. Sin cambios en DB, solo lógica en el cliente.

**Archivos a modificar:**
- `src/hooks/useEmbarqueMutations.ts` — insertar evento automático al avanzar estado
- `src/hooks/useEmbarqueQueries.ts` o `useEmbarqueUtils.ts` — insertar evento al sincronizar estado automáticamente

### Opción B: Integración con API Externa de Tracking (Esfuerzo Alto)

Conectar con APIs de rastreo de contenedores (ej: MarineTraffic, Searates, GoComet) para recibir actualizaciones automáticas basadas en el número de BL o contenedor. Requiere:
- Backend function (edge function) que consulte la API periódicamente
- Cron job para polling
- API key del servicio externo
- Mapeo de eventos de la API a los tipos de evento del sistema

Esto es significativamente más complejo y requiere una suscripción a un servicio de tracking.

---

## Recomendación

**Implementar la Opción A primero**: es de esfuerzo bajo, no requiere servicios externos, y garantiza que cada cambio de estado quede registrado automáticamente en la línea de tiempo. Los operadores pueden seguir agregando eventos manuales adicionales (transbordos, inspecciones, demoras) cuando sea necesario.

La Opción B puede considerarse como una fase futura cuando el volumen de operaciones justifique la inversión en un servicio de tracking.

