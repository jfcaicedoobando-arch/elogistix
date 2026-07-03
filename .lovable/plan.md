# Fix: PATCH /embarque_contenedores devuelve 500

## Diagnóstico (analogía)

Los dos errores nuevos de Sentry son en realidad **el mismo bug**:

- `JAVASCRIPT-REACT-1W`: HTTP 500 al hacer `PATCH` a `embarque_contenedores`.
- `JAVASCRIPT-REACT-1V`: el mismo 500 re-emitido por React Query (`record "v_cond" is not assigned yet`, código Postgres `55000`).

**Analogía**: es como preguntar "¿de qué color es el coche?" cuando todavía no compraste ningún coche. En la función SQL `calcular_demoras_embarque` (que se dispara por trigger cada vez que se edita un contenedor) hay una variable `v_cond record` que solo se llena si el embarque tiene una naviera con condiciones configuradas. Si no las tiene, más abajo se hace `IF v_cond.id IS NOT NULL` — pero como `v_cond` nunca se "compró", Postgres lanza el error 55000 y aborta la actualización.

Este bug afecta a cualquier embarque cuya naviera no esté en `costeo_navieras_condiciones` (o cuando `v_naviera_id` no matchea), por eso truena al editar fechas/dias libres del contenedor.

## Cambio propuesto

Nueva migración que reemplaza `public.calcular_demoras_embarque(uuid)`:

1. Añadir bandera `v_cond_found boolean := false` y un `v_cond_id uuid`.
2. Al entrar al bloque de condiciones naviera, si `FOUND`, marcar `v_cond_found := true` y guardar `v_cond_id := v_cond.id`.
3. Cambiar `IF v_cond.id IS NOT NULL AND v_tipo_cont_id IS NOT NULL` por `IF v_cond_found AND v_tipo_cont_id IS NOT NULL`, y usar `v_cond_id` en el `WHERE naviera_condicion_id = v_cond_id`.
4. Mantener firma, permisos (`REVOKE ... FROM PUBLIC, anon; GRANT EXECUTE TO authenticated, service_role;`) y comportamiento actual cuando sí hay condiciones.

Con esto, cuando no haya condiciones naviera, el cálculo de venta por tabulador propio sigue funcionando y no se toca la parte de costo (queda en 0) — que es el comportamiento esperado.

## Verificación

- Reproducir localmente: `UPDATE embarque_contenedores SET fecha_descarga = ... WHERE id = ...` sobre un embarque sin `costeo_navieras_condiciones` no debe fallar.
- E2E: editar fechas del contenedor en `/embarques/:id` desde la UI (ruta donde ocurrió el crash) — el PATCH debe responder 204.
- Correr `bunx vitest run` para los tests existentes de embarques.

## Fuera de alcance

- No se cambia lógica de cálculo ni tabuladores.
- No se toca el frontend; el toast rojo del PATCH desaparece cuando el trigger deja de tirar.

## Changelog / versión

- Bump `APP_VERSION` a `13.160.1` (patch).
- Entrada en `CHANGELOG.md`.
