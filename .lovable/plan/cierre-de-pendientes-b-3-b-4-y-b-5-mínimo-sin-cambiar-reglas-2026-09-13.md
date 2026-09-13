# Cierre de pendientes B-3, B-4 y B-5 (mínimo, sin cambiar reglas de negocio)

## Resumen para ti

Tres pendientes de baja prioridad. Solo uno amerita cambio real (B-3). Los otros dos se investigan
con pruebas y se documentan; si aparece ambigüedad de negocio, se te pregunta antes de tocar nada.

Analogía: B-3 es poner un sello en el recibo para que si vuelves a entregar el mismo pago, te
devuelvan el recibo existente en lugar de gritarte; B-4 y B-5 son revisiones con lupa: primero
comprobamos si el problema existe.

---

## B-3 — Pago de liquidación repetido (sí se corrige)

Hoy `registrar_pago_liquidacion` toma el candado, valida rol y org, y si la liquidación ya está
pagada lanza `LC_LIQUIDACION_YA_PAGADA`. Un reintento de red o un doble envío del mismo pago
(misma fecha, mismo método, misma referencia) termina en error visible aunque el pago sí quedó
registrado.

Cambio mínimo propuesto:

- Antes de lanzar `LC_LIQUIDACION_YA_PAGADA`, si la liquidación ya está `Pagada` **y** los datos
  entrantes son idénticos a los guardados (`fecha_pago`, `metodo_pago` y `referencia` cuando se
  envía), devolver la fila existente — la misma respuesta que devuelve un pago exitoso.
- Si los datos difieren, se conserva el error actual sin cambios.
- No se toca el candado `FOR UPDATE`, ni el orden fila→autorización, ni la validación de rol, ni la
  bitácora, ni el estado, ni importes.
- No se agrega parámetro `p_request_id`: obligaría a cambiar la firma de la función, el frontend y
  las listas de permisos. Descartado por YAGNI.

Prueba focalizada nueva: `supabase/tests/comision_pago_liquidacion_idempotente.sql`
- reintento con datos idénticos → devuelve la fila y no duplica bitácora ni cambia `updated_at` de
  forma incoherente;
- reintento con fecha o método distintos → sigue fallando con `LC_LIQUIDACION_YA_PAGADA`;
- liquidación cancelada → sigue fallando igual que hoy.

## B-4 — `pnl_base` / `calculo_snapshot` al cerrar embarque (investigación)

Lo verificado en el código: `cerrar_embarque` calcula el P&L, cierra el embarque, recalcula las
comisiones marcadas con nota y **después** escribe `pnl_base` y `calculo_snapshot` en todas las
comisiones del embarque. Es decir, el orden ya parece correcto.

Riesgo real por confirmar: el recálculo puede dejar filas cuyo `embarque_id` no corresponda al
embarque que se cierra (el `ON CONFLICT` reasigna `embarque_id`), y esas filas no recibirían
`pnl_base`. También hay que confirmar que el `UPDATE` posterior no pisa comisiones ya `Liquidada`
con un P&L nuevo.

Acción: prueba de reproducción `supabase/tests/comision_pnl_base_cierre.sql` que cierra un embarque
con una comisión pendiente de recálculo y verifica `definitiva`, `pnl_base` y `calculo_snapshot`.

- Si reproduce el desfase, se corrige solo el alcance del `UPDATE` (misma función, sin nuevas
  reglas).
- Si no reproduce, la prueba queda como regresión y B-4 se documenta como **descartado** en el
  changelog, sin cambios de función.

## B-5 — Prorrateo cotización → varios contenedores (solo validar)

Verificado: para costos con `unidad_medida = 'Contenedor'`, se toma
`costo_total` (o `costo_unitario * cantidad`) y ese importe **total** se reparte entre los
contenedores del embarque con método del resto mayor. Si la cotización se hizo con `cantidad = 2` y
el embarque se crea con 3 contenedores, el total se conserva pero el costo por contenedor ya no
equivale al unitario cotizado.

Aquí hay dos lecturas posibles de `cantidad` (número de contenedores cotizados vs. multiplicador de
unidades) y **no se cambia el prorrateo** sin tu confirmación.

Acción: prueba de caracterización `supabase/tests/prorrateo_cotizacion_cantidad_multi_contenedor.sql`
que documenta el comportamiento actual con `cantidad > 1` y N contenedores (suma total conservada,
reparto por contenedor). Queda registrado como decisión de producto pendiente.

## Notas técnicas

- Migración: una sola, únicamente para `registrar_pago_liquidacion` (y para B-4 solo si la prueba
  reproduce el problema). Sin cambios de firma, permisos ni RLS.
- Espejos: sincronizar `supabase/schema/comisiones/registrar_pago_liquidacion.sql` (y
  `cerrar_embarque.sql` si aplica) + `audit:schema-functions`.
- Sin cambios de frontend.
- Bump de `APP_VERSION` + entrada en `CHANGELOG.md`.
- Validación local: typecheck, lint y pruebas focalizadas, `audit:manifest`, `db:postcheck`.
  CI/RLS/E2E completos quedan para GitHub Actions.

## Al terminar te reporto

- Qué queda confirmado y probado (B-3, y B-4 según resultado).
- Qué requiere decisión de producto: la semántica de `cantidad` en el prorrateo (B-5).
