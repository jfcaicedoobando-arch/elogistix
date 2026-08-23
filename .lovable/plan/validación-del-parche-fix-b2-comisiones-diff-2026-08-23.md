# Validación del parche `fix-b2-comisiones.diff`

Revisé cada afirmación del parche contra la base viva y el orden real de migraciones. Analogía: el parche llega con una lista de reparaciones del mes pasado; el plomero (nosotros) ya arregló tres de las cuatro fugas la semana pasada, y sólo queda una gotera pequeña más los "sellos" que evitan que la fuga regrese.

## Lo que ya NO es bug (corregido en v13.725.0 / v13.726.0)

| Hallazgo del parche | Estado real | Evidencia |
|---|---|---|
| B-2 · comisión 0 en silencio para facturas consolidadas | **Ya corregido** | La `calcular_comision_pago` viva sí llama `comision_embarques_de_factura` y encola en la cola de recálculo |
| B-4 · la NC no bajaba la comisión | **Ya corregido** | La función viva topa el numerador: `LEAST(cobrado, venta neta) / venta bruta` |
| B-5 · periodo de liquidación fuera de horario CDMX | **Ya corregido** | `generar_liquidacion_comision` usa `AT TIME ZONE 'America/Mexico_City'` en las dos consultas de periodo |
| Regresión de replay (el espejo `20260826003000` pisaba los fixes) | **Ya cerrado** | El espejo `20260828000200_rev2_espejo_comisiones_nc_y_periodo.sql` es posterior a todas las que pisaban |
| Cableado en CI de `ola2_faseb_regresion.sql` y `ola2_faseb2_regresion.sql` | **Ya está** | líneas 498 y 501 de `rls-tests.yml` |
| `REVOKE` de funciones de plataforma en `_ci_post_migrate.sql` | **Ya está** | aplicado en v13.726.1 |

Aplicar el parche tal cual re-emitiría las mismas funciones con timestamp **anterior** al espejo vigente, así que además de redundante sería riesgoso.

## Lo que sí es bug real (1 hallazgo)

**El reproceso nocturno cierra los ajustes de NC sobre comisiones ya liquidadas sin aplicar el descuento.**
Hoy `_reprocesar_comisiones_org` recorre todos los pendientes; si la comisión está `Liquidada`, marca `resuelto_at` y lo saca de la cola. El ajuste que dejó la nota de crédito para descontar en la siguiente liquidación desaparece de la vista de finanzas sin haberse aplicado.

Impacto actual medido: la cola está vacía y hay 0 comisiones en estado `Liquidada`, así que **no hay dinero mal pagado hoy**; es un bug latente que morderá en el primer cierre de comisiones real.

## Brechas de mantenimiento que vale la pena cerrar

- No existen espejos canónicos de `calcular_comision_pago` ni `generar_liquidacion_comision` en `supabase/schema/comisiones/` (sólo `comision_cobrado_mxn.sql`), por lo que el guardrail de replay no vigila justo las funciones que ya se rompieron dos veces por replay.
- No hay pruebas de comportamiento para "la NC baja la comisión" ni "el periodo respeta CDMX"; sólo pruebas de texto de la definición.

## Trabajo propuesto

1. **Fix real (etapa 1)**: migración nueva (timestamp posterior a `20260828000300`) que re-emite `_reprocesar_comisiones_org` excluyendo de la cola las entradas con `etapa = 'ajuste_nc_liquidada'`, con el `COMMENT` y los permisos `service_role`-only actuales.
2. **Espejos canónicos (etapa 2)**: agregar `supabase/schema/comisiones/calcular_comision_pago.sql` y `generar_liquidacion_comision.sql` tomados del estado vivo, para que `audit:replay-mirror` / `audit:schema-functions` detecten futuras regresiones de replay.
3. **Pruebas (etapa 3)**: incorporar del parche las dos pruebas de comportamiento (`fix_b4_nc_reduce_comision.sql`, `fix_b5_periodo_cdmx.sql`) más un caso nuevo que verifique que el reproceso NO cierra `ajuste_nc_liquidada`, y cablearlas en `rls-tests.yml`.
4. **Cierre**: sincronizar `migration-manifest.json`, bump de `APP_VERSION` a `13.728.0` y entrada en `CHANGELOG.md` aclarando qué del parche se descartó y por qué.

## Detalles técnicos

- Nada del parche se aplica textualmente en migraciones: sólo se reutiliza el fragmento de `_reprocesar_comisiones_org` y los archivos de prueba, adaptados al cuerpo vivo de las funciones.
- Se respeta H6: `SECURITY DEFINER` + `REVOKE ALL ... FROM PUBLIC, anon, authenticated` + `GRANT EXECUTE ... TO service_role`.
- No se tocan datos existentes; la cola está vacía, así que no hay backfill.
