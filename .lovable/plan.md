

## Agregar Aceptar/Rechazar cotización desde el portal del cliente

**Objetivo**: Permitir que el cliente acepte o rechace una cotización directamente desde el portal cuando está en estado "Enviada".

### Problema actual
Los clientes solo tienen permiso de lectura (SELECT) en la tabla `cotizaciones`. No pueden actualizar el estado.

### Solución

**1. Función de base de datos (SECURITY DEFINER)**

Crear una función `portal_responder_cotizacion(p_cotizacion_id uuid, p_respuesta text)` que:
- Valide que el usuario autenticado es cliente y la cotización le pertenece (via `current_user_client_ids()`)
- Valide que la cotización está en estado "Enviada"
- Valide que `p_respuesta` sea "Aceptada" o "Rechazada"
- Actualice el estado de la cotización
- Retorne el registro actualizado

Usar SECURITY DEFINER evita necesitar una política UPDATE para clientes, manteniendo la seguridad.

**2. Actualizar `PortalCotizacionDetalle.tsx`**

- Agregar botones "Aceptar Cotización" y "Rechazar Cotización" visibles solo cuando `cot.estado === 'Enviada'`
- Incluir un AlertDialog de confirmación antes de ejecutar la acción
- Llamar a la función RPC `portal_responder_cotizacion` via `supabase.rpc()`
- Mostrar toast de éxito/error y refrescar los datos
- Mostrar un banner informativo cuando ya fue aceptada/rechazada

**3. Actualizar Changelog** a v8.0.2

### Archivos a modificar
- **Migración SQL**: nueva función `portal_responder_cotizacion`
- `src/pages/portal/PortalCotizacionDetalle.tsx`: botones + dialogs + mutación
- `src/pages/Changelog.tsx`: nueva entrada

