

## Agregar comentarios del cliente al aceptar/rechazar cotización

### Resumen
Permitir que el cliente escriba un comentario opcional al momento de aceptar o rechazar una cotización. El comentario se guarda en un nuevo campo `comentario_cliente` en la tabla `cotizaciones` y se muestra tanto en el portal como en el detalle interno.

### Cambios

**1. Migración SQL**
- Agregar columna `comentario_cliente text` (nullable) a la tabla `cotizaciones`
- Actualizar la función `portal_responder_cotizacion` para aceptar un tercer parámetro `p_comentario text DEFAULT ''` y guardar el valor en el nuevo campo

**2. `src/pages/portal/PortalCotizacionDetalle.tsx`**
- Agregar estado `comentario` con `useState("")`
- Importar `Textarea` de `@/components/ui/textarea`
- Agregar un campo `Textarea` dentro del `AlertDialog` debajo de la descripción, con placeholder contextual ("¿Algún comentario?" / "¿Motivo del rechazo?")
- Pasar `p_comentario: comentario` en la llamada RPC
- Limpiar el comentario al cerrar el dialog
- Mostrar el `comentario_cliente` guardado en los banners de estado Aceptada/Rechazada si existe

**3. `src/pages/CotizacionDetalle.tsx`** (vista interna)
- Mostrar el campo `comentario_cliente` si existe, en una sección visible para el equipo de operaciones

**4. `src/pages/Changelog.tsx`**
- Agregar entrada v8.0.3

### Detalle técnico

```sql
ALTER TABLE cotizaciones ADD COLUMN comentario_cliente text;

CREATE OR REPLACE FUNCTION public.portal_responder_cotizacion(
  p_cotizacion_id uuid, p_respuesta text, p_comentario text DEFAULT ''
) RETURNS jsonb ...
-- Agrega: SET comentario_cliente = NULLIF(trim(p_comentario), '')
```

