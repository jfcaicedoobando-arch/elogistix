# Timbrar sin que la fecha de ayer detenga la factura

## Qué pasa hoy

Cuando una factura se captura un día y se sella al siguiente, el sistema la detiene con el aviso "La factura tiene fecha 2026-09-17 y hoy es 2026-09-18. Actualiza la fecha…". El problema: en la pantalla no existe ningún lugar para cambiar esa fecha, así que la factura queda atorada (es el caso reportado por Karol en Elogistix).

## Qué va a cambiar

Al pulsar "Timbrar", el sistema pondrá la fecha de hoy en la factura automáticamente y volverá a tomar el tipo de cambio del DOF vigente para ese día, justo antes de sellar. Ya no habrá aviso de bloqueo.

- Solo aplica a facturas en borrador / por timbrar. Una factura ya timbrada nunca se toca.
- La fecha de vencimiento se recalcula sola con los días de crédito del cliente.
- El cambio queda registrado en la bitácora (quién timbró, fecha anterior y fecha nueva).
- Si el DOF aún no tiene publicación utilizable para hoy, sí se detiene, con un mensaje claro y reintentable: no se sella una factura con un tipo de cambio inventado ni obsoleto.
- En el recuadro de timbrado se añade una nota informativa (no bloqueante) cuando la factura trae fecha de otro día: "Se emitirá con fecha de hoy y el tipo de cambio DOF del día".

## Detalles técnicos

1. `supabase/functions/facturapi-emitir/emitir.ts`
   - `validarFechaEmisionVigente` deja de devolver 422 y se sustituye por `realinearFechaEmision(supabase, factura, now)`: si `fecha_emision !== hoyMx()` y la factura no tiene `uuid_fiscal`, hace `update facturas set fecha_emision = hoy` filtrando por estado timbrable y `deleted_at is null`, y devuelve la fila releída.
   - El trigger existente `_factura_tc_dof_obligatorio` ya resuelve `tipo_cambio` desde `tc_dof_vigente(fecha_emision)`, y `facturas_set_fecha_vencimiento` recalcula el vencimiento: no se duplica esa lógica en la edge.
   - Los errores `LC_FACTURA_SIN_TC_DOF` y `LC_FACTURA_TC_DOF_OBSOLETO` se traducen a 422 `tc_dof_no_disponible` con mensaje accionable, antes del claim y antes del PAC.
   - El realineo corre antes de `validarTipoCambio` / cuadre fiscal, para que el resto de los guards validen la fila ya actualizada.
   - Se registra en bitácora (`registrarBitacoraEdge`) la acción `realinear_fecha_emision_timbrado` con fecha anterior y nueva.

2. `src/features/facturacion/utils/estadoTimbrado.ts` + `validarDatosTimbrado.ts`
   - Nueva advertencia informativa (no cambia `puedeTimbrar`) cuando `fecha_emision` no es hoy en zona México; el helper de fecha vive en un módulo puro reutilizable.

3. Pruebas
   - Deno (`facturapi-emitir`): fecha de ayer → se actualiza y continúa; fecha de hoy → no hay update; factura timbrada → no se toca; DOF sin dato → 422 reintentable sin claim ni llamada al PAC; estado no timbrable → sigue 409.
   - Vitest: la advertencia informativa aparece con fecha desfasada y no bloquea el botón.

4. Sin migración de base: los triggers necesarios ya existen. Se versiona `APP_VERSION` + entrada en `CHANGELOG.md`.

## Validaciones

Pruebas focalizadas de `facturapi-emitir` (Deno) y de facturación (Vitest), `tsgo --noEmit` y build. CI completo, RLS y E2E quedan para GitHub Actions. No se publica.
