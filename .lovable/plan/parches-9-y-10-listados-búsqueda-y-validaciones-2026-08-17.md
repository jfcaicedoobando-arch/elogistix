# Parches 9 y 10: listados/búsqueda y validaciones

Los dos parches subidos aplican limpio sobre la versión actual (13.638.0). Verificado en seco: patch-9 (8 archivos) y patch-10 (16 archivos) sin conflictos.

## Parche 9 — listados, paginación y búsqueda

- Buzón "Por enviar": las facturas ya enviadas dejan de reaparecer; se pagina la consulta de envíos en bloques de 1000 en lugar de confiar en el límite silencioso del servidor.
- Conteos del buzón: "Por enviar" se calcula con facturas distintas ya enviadas (deja de desfasarse cuando hay reenvíos).
- Búsqueda global: se descarta la respuesta vieja cuando el usuario sigue escribiendo (ya no "gana" el término anterior).
- Búsqueda de CRM: los errores se propagan para que la búsqueda muestre estado de falla en vez de "sin resultados".
- Exportación de embarques: orden estable (desempate por id) mediante una migración nueva sobre la RPC del listado, más deduplicación por id entre páginas.
- Avisos cuando un listado se corta por límite (facturas por timbrar/por enviar, catálogos, oportunidades).

## Parche 10 — validaciones de formularios

- Importes: "50.000" se interpreta como 50 mil, no como 50 pesos.
- Anticipos: topes de monto y tipo de cambio, máximo 2 decimales, fecha válida.
- CRM: la probabilidad se acota a 0–100 en captura y al guardar.
- Seguros de embarque: se rechazan suma asegurada y deducible negativos; en altas se exige suma mayor a 0.
- Factura de proveedor: días de crédito enteros entre 0 y 365 y aviso si el vencimiento queda demasiado lejos de la emisión.
- Admin (planes y seguridad global) y tabulador de demoras de venta: rangos válidos antes de guardar.

## Detalles técnicos

- Aplicación con `patch -p1` (no `git apply`, bloqueado en el entorno).
- Migración nueva incluida en patch-9: `20260824090000_ec16_embarques_listado_tiebreaker_id.sql`, que reescribe los `ORDER BY` de `embarques_listado` con `pg_get_functiondef` + `replace` y falla ruidosamente si el patrón no coincide. Se ejecutará como migración aprobada aparte.
- Nuevo helper `warnIfTruncated` en `src/lib/supabase/assertNotTruncated.ts` (variante no bloqueante).
- `TC_MAX` pasa de privada a exportada en `pagoProveedorValidaciones.ts` (retro-compatible).
- Tests nuevos/actualizados: `moneyInputFormat`, `registrarAnticipoSchema`, `oportunidadPayload`, `useNuevaFacturaProveedorForm.diasCredito`, `demorasVenta.extra`.

## Verificación y cierre

1. Aplicar patch-9 y patch-10.
2. Ejecutar la migración del tie-breaker.
3. Correr typecheck y la suite de pruebas.
4. Actualizar `CHANGELOG.md` y subir `APP_VERSION` a **13.639.0**.
