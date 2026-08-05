# Corregir error "el documento ya fue capturada" en el Buzón de compras

## Qué está pasando

Al capturar una factura desde el buzón (`/compras/buzon`) el sistema hace dos cosas seguidas:

1. Guarda la factura de proveedor.
2. Marca el documento del buzón como "capturado".

Pero desde la versión del 4 de agosto existe un automatismo en la base de datos (`trg_cerrar_entrantes_por_uuid`) que, al guardar una factura con UUID fiscal (CFDI), **ya cierra solo** el documento del buzón que tiene ese mismo UUID.

Resultado: cuando llega el paso 2, el documento ya está en estado `capturada` y la validación `IF v_doc.estado <> 'por_capturar' THEN RAISE 'LC_ESTADO_INVALIDO'` truena. La factura sí quedó guardada correctamente; sólo el aviso final falla y confunde al usuario.

Analogía: dos personas van a ponerle el sello de "capturado" al mismo expediente. La primera lo sella; la segunda se queja de que ya estaba sellado, en lugar de simplemente dejarlo así.

## Solución

Hacer que el paso 2 sea idempotente (que "no se queje si ya estaba hecho"):

- Si el documento ya está `capturada` **y** apunta a la misma factura que se acaba de crear → no hacer nada y terminar con éxito.
- Si está `capturada` pero apunta a **otra** factura → seguir mostrando error (ahí sí hay un conflicto real, con mensaje claro que nombre el folio de la factura que ya lo tiene).
- Si está `rechazada` → seguir bloqueando con mensaje claro.

## Detalles técnicos

1. **Migración** — `CREATE OR REPLACE FUNCTION public.capturar_factura_entrante(uuid, uuid)`:
   - Reemplazar el bloque de validación de estado por:
     - `estado = 'capturada' AND proveedor_factura_id = p_factura_id` → `RETURN;` (salida temprana, sin error).
     - `estado = 'capturada'` con otra factura → `RAISE 'LC_ESTADO_INVALIDO: el documento ya está vinculado a otra factura de proveedor'`.
     - `estado = 'rechazada'` → `RAISE 'LC_ESTADO_INVALIDO: el documento fue rechazado; solicita que se vuelva a subir'`.
   - Conservar permisos existentes: `REVOKE ALL ... FROM PUBLIC` + `GRANT EXECUTE ... TO authenticated`.

2. **Mensajes** — Revisar `src/lib/errors/lcCodeMessages.operativo.ts` para que `LC_ESTADO_INVALIDO` en este contexto se lea en español claro (sin la concordancia rota "ya fue capturada").

3. **Frontend** — `useCapturaEntranteWiring.ts` / `useFacturasEntrantes.ts` no requieren cambio lógico; el hook ya invalida el caché del buzón. Sólo se verifica que el toast de éxito siga silenciado en el flujo del formulario.

4. **Pruebas** — Agregar caso en las pruebas de servicios CxP: capturar dos veces el mismo documento con la misma factura no debe lanzar error.

5. **Cierre** — Bump de `APP_VERSION`, entrada en `CHANGELOG.md` y marcar el issue de Sentry como resuelto.
