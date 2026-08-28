# Backlog v4 (45 bugs): auditoría de estado real y cierre de lo que queda

Revisé el backlog contra la base y el código actual. La gran mayoría ya quedó cerrada en las olas E1–E4 de los turnos anteriores. Esto es lo que verifiqué hoy y lo que propongo hacer.

## Ya cerrado (verificado hoy)

- N22 · `bbva_movimientos` sí tiene el CHECK cargo/abono y está **validado**.
- N16 · No existe ninguna policy UPDATE sin WITH CHECK en `cobranza_seguimiento` ni `cotizacion_plantillas`.
- C4 · `embarques` tiene triggers `_assert_padre_misma_org` para `cliente_id`, `cotizacion_id`, `tarifa_id` y `agente_id`.
- C5 · `crear_proforma_atomica` ya exige `embarque_id`/`cliente_id` en la selección bloqueada.
- C3-res · Los tres hijos de CxP (`proveedor_facturas_conceptos`, `proveedor_notas_credito`, `anticipos_proveedor`) ya tienen triggers de misma-org.
- C1-res · `facturas_cartera_cliente` ya usa el canon de NC convertidas.
- C8-res · `bloquear_modificacion_factura_emitida` ya protege `xml_url`.
- N10 · `calc_pago_retenciones` ya descuenta NC de la base.
- N1 (REP crítico) · `context.ts` ya calcula `saldoAnt = total − pagos − NCs`.
- N23 · `exchange-rates` ya valida la fecha con round-trip.
- N25 · el hash BBVA ya es por contenido (fecha|concepto|referencia|cargo|abono) con sufijo ordinal sólo para duplicados idénticos dentro del archivo.

## Lo que sigue abierto y propongo corregir

### Tanda 1 — Base de datos (3 puntos)

1. **N6 residual · `seed_presupuesto_categorias(uuid)` sigue ejecutable por `authenticated`.**
   Las otras 4 funciones del hallazgo ya están revocadas; falta ésta. Revocar de `authenticated`, dejar `service_role`, y añadirla a la lista canónica de `supabase/tests/rls/_ci_service_role_only.sql`. Antes de revocar, buscar si algún componente la invoca; si sí, envolverla con guard de rol administrativo en lugar de revocar a ciegas.

2. **M3 residual · falta el índice único de email en `clientes`.**
   Hoy la unicidad depende sólo del trigger, así que dos altas simultáneas pueden duplicar. Crear índice único parcial sobre `(organization_id, lower(btrim(email)))` donde el email no sea nulo. Primero reviso si hay duplicados históricos; si los hay, te los reporto para decidir cómo consolidarlos antes de crear el índice (no borro datos sin tu confirmación).

3. **M1 residual · `profit_por_cliente` no resta notas de crédito.**
   El reporte de rentabilidad por cliente infla los ingresos porque no descuenta NC aplicadas. Reemitir la función restando el canon de NC en moneda de factura y excluyendo facturas canceladas. Test SQL de guard para fijar el comportamiento.

### Tanda 2 — Frontend (1 punto)

4. **N9 · Presupuesto vs Real valúa EUR con tipo de cambio USD.**
   `vsRealDomain.ts` aplica `tipo_cambio_usd` a cualquier moneda distinta de MXN. Como no existe `tipo_cambio_eur` en `proveedor_facturas`, la ruta correcta es convertir vía el canon de paridad DOF por moneda en lugar de multiplicar por el TC USD; los gastos en EUR sin paridad se excluyen del real igual que hoy, con la nota visible ya existente.

## Analogía rápida

El backlog v4 es una lista de reparaciones de una casa que ya se repararon en visitas anteriores: la lista no se actualizó. Al pasar cuarto por cuarto encontré tres cerraduras y una regla de conversión que sí siguen flojas; esas son las que voy a apretar.

## Detalles técnicos

- Cada punto de la Tanda 1 va como migración (necesitan tu aprobación) más su test en `supabase/tests/`.
- Tras los cambios de esquema: resincronizar `supabase/schema/baseline.sql` y el manifiesto de releases, y correr `bun run db:verify:all` / los guards de CI.
- Cierre estándar: entrada en `CHANGELOG.md` (raíz) y bump de `APP_VERSION`.
- No entra nada de E4/E5 del documento (`N-F1`, `N-F4`, `N13`): dependen de squash de migraciones y de decisiones de producto que conviene tratar por separado.

## Lo que queda como "no verificado"

No revisé en esta pasada: N21, N24, N12, N-F3, N27, L4, L3, M2-res, M5-res, N15, N7, N11, N5, C9, N18, N19, N-F2, N14, N17, N2, N20, N3, N4, N8, M6, M7-res. Varios de ellos se cerraron en olas previas según el historial, pero no lo confirmé hoy. Si quieres, agrego una pasada de verificación de ese grupo antes de tocar código.
