## Diagnóstico

La tarjeta de historial no está fallando por carga visual; está recibiendo una lista vacía desde la API.

Causas encontradas:
- La tarjeta consulta sólo `modulo = 'facturas'`, pero los eventos importantes de CFDI/timbrado/cancelación/sustitución se guardan como `modulo = 'facturacion'`.
- La política de lectura de `bitacora_actividad` sólo deja ver eventos propios o a administradores de organización; si el evento lo creó otro usuario/función, un usuario con acceso a la factura puede ver la factura pero no su historial.
- La factura actual en pantalla (`5945...`) sí tiene al menos un evento en base de datos, pero la API lo devuelve como `[]`, consistente con la restricción de RLS/permisos.

Analogía: la factura es una carpeta compartida, pero el historial estaba guardado en dos archiveros distintos y además algunas hojas sólo las podía leer quien las escribió.

## Plan de implementación

1. **Crear lectura segura de historial por factura**
   - Agregar una RPC/función de sólo lectura para devolver eventos de bitácora de una factura específica.
   - La función validará primero que el usuario tenga acceso a esa factura por organización/rol.
   - Sólo después devolverá eventos relacionados, evitando abrir toda la bitácora general.

2. **Unificar eventos relevantes de facturación**
   - Incluir eventos con `modulo IN ('facturas', 'facturacion')`.
   - Filtrar por `entidad_id = facturaId`.
   - Considerar eventos de sustitución/cancelación que referencien la factura en `detalles` cuando aplique, para que F975/F991 y casos similares queden rastreables.

3. **Actualizar la tarjeta `Historial de la factura`**
   - Cambiar `FacturaBitacoraCard` para usar el nuevo lector específico de factura, no el listado global de auditoría.
   - Mantener el diseño actual y las etiquetas legibles.
   - Si hay error de permisos, mostrar mensaje discreto en vez de “Sin eventos” para no confundir.

4. **Corregir etiquetas y contexto**
   - Reusar/centralizar las descripciones humanas de bitácora cuando sea posible.
   - Mostrar fecha, acción y actor cuando esté disponible.

5. **Tests y verificación**
   - Añadir pruebas para el servicio/hook de historial de factura.
   - Verificar con la factura actual que la API ya no regresa `[]`.
   - Actualizar `APP_VERSION` y `CHANGELOG.md` como regla del proyecto.

## Resultado esperado

La tarjeta mostrará eventos reales de la factura aunque hayan sido generados por funciones internas o por otro usuario autorizado, sin exponer la bitácora completa a usuarios que no deberían verla.