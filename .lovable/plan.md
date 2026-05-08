# Arreglar error "Failed to send a request to the Edge Function"

## Diagnóstico

1. **Causa principal del error visible**: las edge functions `terminal49-create-tracking` y `terminal49-sync` existen como archivos en el repo pero **no están desplegadas** en el backend. La llamada devuelve `404 NOT_FOUND`.
2. **Bug secundario detectado en consola**: `Maximum update depth exceeded` originado en `BreadcrumbContext.clearLabel` invocado desde el cleanup de un `useEffect` en `EmbarqueDetalle.tsx`. No bloquea el tracking pero degrada el rendimiento.

## Pasos

1. **Desplegar las edge functions de Terminal49**
   - Forzar despliegue de `terminal49-create-tracking` y `terminal49-sync`.
   - Verificar con una llamada de prueba que respondan (no 404).
   - Revisar logs después del primer clic real para confirmar que la API key de Terminal49 se lee y la petición a `https://api.terminal49.com/v2/tracking_requests` se envía.

2. **Corregir el loop de actualización en `EmbarqueDetalle.tsx`**
   - Estabilizar el `useEffect` que llama a `setLabel`/`clearLabel` del `BreadcrumbContext` para que `clearLabel` no dispare un re-render que vuelva a montar el efecto.
   - Envolver `setLabel` y `clearLabel` en `useCallback` dentro del `BreadcrumbContext` si están redefiniéndose en cada render, o ajustar las dependencias del efecto en `EmbarqueDetalle`.

3. **Validación**
   - Recargar la pestaña Tracking del embarque actual.
   - Pulsar "Activar tracking automático" y confirmar:
     - Aparece toast de éxito.
     - Se crea fila en `tracking_externo`.
     - Aparecen botones "Sincronizar ahora" y "Desactivar".
   - Confirmar que el warning de "Maximum update depth" desaparece de la consola.

## Detalles técnicos

- El despliegue se hace con `supabase--deploy_edge_functions` indicando `["terminal49-create-tracking", "terminal49-sync"]`.
- Si el deploy falla por `deno.lock`, eliminarlo y reintentar (ver guía de troubleshooting de edge deploys).
- Para el loop, el patrón típico es:
  ```ts
  useEffect(() => {
    setLabel(embarque?.numero_embarque ?? '');
    return () => clearLabel();
  }, [embarque?.numero_embarque]); // NO incluir setLabel/clearLabel si no son estables
  ```
  Y en el provider asegurar `useCallback` con deps vacías.

## Fuera de alcance

- Webhook de Terminal49 (sigue planeado para fase 2 cuando tengas el secret).
- Cambios visuales en la card de tracking.
