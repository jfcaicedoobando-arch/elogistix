# Revisión de `fix2-misc.diff` — ¿son bugs reales?

Sí, la mayoría. Verifiqué cada punto contra el código actual y contra la base de datos. Resultado: **3 bugs reales confirmados**, 1 mejora válida de bajo impacto y 1 punto que hoy no aplica en producción.

## Bugs reales confirmados

**B-1 · El selector "sin comisión" del embarque regresa al valor viejo (real).**
`useSinComisionEmbarque` guarda su dato en el árbol *singular* `['embarque', id, 'sin-comision']`, pero al guardar sólo se invalida el prefijo *plural* `['embarques']`. Son dos árboles distintos: es como avisar en la sucursal equivocada — el dato viejo se queda en pantalla. El mismo desajuste afecta al badge de pendientes administrativos (`['embarque', id, 'admin-pendientes']`) al subir/borrar documentos, y al P&L del embarque (`['embarque', id, 'pnl-financiero']`) al editar conceptos.

**B-2 · Riesgo de doble pago a proveedor (real).**
La bandeja "CxP por pagar" y su badge leen el árbol `['bandeja', ...]`. Los hooks de pago a proveedor (individual, lote, editar, eliminar) invalidan `cxp` y `tesoreria`, pero **no** `bandeja`. Otros hooks del mismo módulo (aprobar en lote, cerrar sin pago, programar pago) sí lo invalidan: la omisión es inconsistente y deja la factura ya pagada listada como pendiente.

**B-3 · El barrido SAT semanal sólo revisa las mismas organizaciones (real).**
La edge `verificar-sat-semanal` selecciona orgs con `ORDER BY created_at ASC LIMIT 5`, sin rotación: las orgs 6+ nunca se verifican. Además `MAX_FACTURAS = 60` con `POR_ORG = 20` significa que las 3 primeras orgs agotan el cupo y el resto del lote se queda en cero. Hoy hay 4 orgs con RFC, así que el impacto es latente, pero se activa al crecer.

## Mejora válida (bajo impacto)

**M-1 · Invalidaciones tras timbrar/cancelar CFDI y notas de crédito.**
Hoy sólo se invalida `facturas` + el hueco de facturación; las notas de crédito sólo invalidan sus propias listas. Cartera/aging (`cxc`) y bandejas no se refrescan, así que un CFDI cancelado o con NC aplicada puede seguir viéndose como cobrable por el saldo anterior hasta recargar. Se centraliza en un helper `invalidarTrasTimbrado`, igual que ya existe `invalidarRep`.

## No aplica hoy

**N-1 · Agendado del job en base limpia.** El parche añade una vía por vault para agendar el cron. Verifiqué la base: el job `verificar_sat_semanal` **ya está agendado** (lunes 14:00 UTC). Sólo aporta en despliegues limpios/CI, así que lo incluyo como refuerzo, no como fix urgente.

## Qué implementar

1. Invalidar las llaves exactas del árbol singular del embarque: `sinComision` en el toggle de comisión, `adminPendientes` en mutaciones de documentos y `pnlFinanciero` en `useUpdateEmbarque`. Documentar en `queryKeys.ts` que `['embarques']` no cubre `['embarque', id, ...]`.
2. Agregar `queryKeys.bandejas.all` (y `proveedores.all` donde falte) a los cuatro hooks de pago a proveedor.
3. Crear `invalidarTrasTimbrado` y usarlo en timbrar/cancelar factura y en timbrar/cancelar nota de crédito.
4. Migración: columna `organizations.sat_barrido_fecha` + RPC `seleccionar_lote_sat_semanal(integer)` (SECURITY DEFINER, sólo `service_role`, orden `sat_barrido_fecha ASC NULLS FIRST` con `FOR UPDATE` y estampado atómico). La edge pasa a usar la RPC, con `MAX_FACTURAS = 50` y `POR_ORG = MAX_FACTURAS / MAX_ORGS`. Se agrega el espejo canónico en `supabase/schema/` y la prueba SQL de rotación.
5. Refuerzo del agendado por vault con el mecanismo actual como respaldo (idempotente, no toca el job existente).
6. Pruebas: test del hook `useSinComisionEmbarque`, test SQL de rotación del lote, y sincronización del manifiesto de migraciones. Bump de `APP_VERSION` + entrada en `CHANGELOG.md`.

## Notas técnicas

- La RPC nueva se declara con `SET search_path TO ''` y `REVOKE` a `anon`/`authenticated` para no romper el guardrail FIX-45 ni la suite de permisos H6.
- Se agregarán las migraciones espejo posteriores requeridas por `drift-anclas.txt` si CI reporta drift.
- Los tipos de `src/integrations/supabase/types.ts` se regeneran solos tras aplicar la migración; no se editan a mano.
