# Deprecación de JSONCargo

**Estado:** Pendiente de remoción. Mantener el código operativo hasta que se defina e integre el proveedor reemplazo de tracking.

## Decisión

Se descontinúa el uso de JSONCargo como proveedor de tracking marítimo. No se invertirá en evolucionar este integrador (incluido el soporte multi-contenedor que originalmente estaba en el plan de la Fase 2 del refactor 1↔N).

## Inventario de código a remover

Cuando se ejecute la remoción, eliminar/limpiar en este orden:

### Edge Functions
- `supabase/functions/jsoncargo-track/` (función completa)
- `supabase/functions/_shared/jsoncargoSync.ts`
- Cualquier entrada en `supabase/config.toml` referida a `jsoncargo-track` (si existe).

### Frontend
- `src/components/embarque/TrackingLiveCard.tsx` — botón "Sincronizar con JSONCargo" y llamadas a `supabase.functions.invoke('jsoncargo-track', ...)`.
- `src/components/embarque/TabTracking.tsx` — props relacionadas.
- `src/pages/portal/PortalEmbarqueDetalle.tsx` — el `TrackingLiveCard` y la sincronización manual desde portal cliente.
- `src/hooks/embarque/mutations/useUpdateEmbarque.ts:44` — el bloque que dispara re-sync automático al actualizar un embarque marítimo (`invoke('jsoncargo-track', ...)`).
- `src/hooks/embarque/mutations/useCreateEmbarque.ts` — buscar y limpiar invocaciones similares si existen.
- Cualquier referencia a `tracking_externo` específica del proveedor (logo, etiqueta "JSONCargo", etc.). La tabla puede quedarse para el reemplazo.

### Configuración / Secretos
- Variable de entorno `JSONCARGO_API_KEY` (o el nombre que se haya usado) en Lovable Cloud → Edge Function secrets.
- Cualquier entrada en `configuracion_global` con clave relacionada.

### Base de datos
- La tabla `tracking_externo` puede **conservarse** (sirve como caché de tracking para el próximo proveedor). Si el modelo nuevo difiere mucho, evaluar migración.
- No hay columna `provider` actualmente — agregarla cuando se integre el reemplazo para distinguir orígenes.

### Búsqueda recomendada antes de remover
```bash
rg -n "jsoncargo|JSONCargo|JSONCARGO" src/ supabase/
```

## Comportamiento esperado tras la remoción

- Tab Tracking en detalle de embarque: muestra solo eventos manuales / hitos del wizard. Quitar el card "Tracking en vivo".
- Portal cliente: mismo comportamiento.
- Sin llamadas externas automáticas al guardar embarques marítimos.

## Próximos pasos

1. Definir proveedor reemplazo (candidatos típicos: ShipsGo, Vizion, SeaRates, Project44, MarineTraffic API).
2. Diseñar contrato del nuevo edge function (debe soportar multi-contenedor desde el día 1).
3. Ejecutar remoción siguiendo este documento.
4. Implementar el nuevo proveedor en su propio MD/PR.

## Notas

- La Fase 2 del plan `mem://audit/pendings` originalmente incluía "tracking multi-contenedor (edge function + UI)". **Esa tarea queda cancelada** — se reemplaza por: (a) remoción de JSONCargo siguiendo este documento, (b) integración del nuevo proveedor (fuera del refactor 1↔N).
