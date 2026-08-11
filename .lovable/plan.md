# Ola 6 — Cadena de migraciones sana + cola de regresiones

Objetivo: que una base creada desde cero aplique TODAS las migraciones sin abortar y que los fixes de la Ola 5 no se sobrescriban con versiones viejas. Analogía: los fixes están bien escritos, pero están archivados con fecha equivocada, así que el archivo viejo se guarda encima del nuevo.

Verificado en el repo: existen los 4 archivos con nombre UUID (`20260811044637`, `044721`, `044821`, `044915`), existe `20260812090000_ola4_n41_n44_n45_valuacion_fixes.sql` (la que aborta con 42P13) y los archivos de `supabase/migrations/` son editables. `validarCobroLote` hoy no valida `factura_id` duplicada, y `usePagoClienteLote.ts` dispara dos toasts.

## Lo que se hará, en orden

1. **RG4-1 — Neutralizar la migración rota.** Se reemplaza el contenido de `20260812090000_…` por un no-op documentado (mismo nombre de archivo). Sus fixes reales ya viven en migraciones anteriores.
2. **O6-REN + RG5-2 — Renombrar los 4 archivos de la Ola 5** a `20260818090000 / 090100 / 100000 / 110000` con contenido idéntico, salvo un único cambio: `COALESCE(eb.tipo_cambio_eur, 0) > 1` en el CTE `gastos_op_sin_tc` de `dashboard_summary`, para que las facturas EUR sin tipo de cambio sí se cuenten en `gastosOperativosSinTC`.
3. **RG5-1 — Guard de organización fail-closed** en `regenerar_movimiento_pago_proveedor`: si no hay organización resuelta, error `LC_SIN_ORG` (42501) en lugar de saltarse el chequeo cross-org. Migración `20260819090000_…`.
4. **RG5-3 / RG5-4 — Buzón CxP sin limbo ni carreras.** Al rechazar, `_cxp_desvincular_por_rechazo` limpia `proveedor_factura_id`; `retirar_factura_entrante` y `reactivar_factura_entrante` validan estado dentro del propio `UPDATE` (con `ROW_COUNT`) para que una captura concurrente no gane la carrera. Migración `20260819090100_…`.
5. **RG4-6 — Frontend cobro en lote:** `validarCobroLote` rechaza dos renglones a la misma factura con mensaje de formulario, antes del loop de saldos. Con test.
6. **RG5-5 — Un solo toast:** `usePagoClienteLote` devuelve `{ res, rep }` y arma un único aviso en `onSuccess` (éxito, o advertencia si algún REP falló). Se conservan las 4 invalidaciones y el `onError`.
7. **O6-SCHEMA — Copias canónicas** de las 7 funciones más golpeadas en `supabase/schema/**` (`dashboards/`, `facturacion/`, `cxp/`, `comisiones/`) + altas en `supabase/schema/README.md`, 1:1 con las migraciones finales.
8. **Cierre:** suite de pruebas, `audit:migrations`, bump de `APP_VERSION` y entrada en `CHANGELOG.md`.

## Notas técnicas

- Las migraciones nuevas se aplican con la herramienta de migraciones (que auto-nombra el archivo) y luego se renombra el archivo al nombre exacto indicado, para preservar el orden de la cadena.
- Los 4 renombres son seguros en producción: todo su DDL es idempotente (`CREATE OR REPLACE`, `DROP POLICY IF EXISTS`, REVOKE/GRANT); al desplegarse se re-aplican con el mismo cuerpo. Las versiones UUID viejas quedan registradas sin archivo local (limpieza opcional con `migration repair`, cosmética).
- Firmas sin cambios en todas las funciones tocadas (sin riesgo 42P13); se conservan `SECURITY DEFINER`, `search_path`, códigos `LC_*` y grants tal como los deja la cadena.
- No se toca `aprobar_factura_proveedor` ni los helpers de dominio de entrantes: la migración deja `estado` + `proveedorFacturaId` coherentes y la UI vuelve a mostrar "Reactivar" sola.

## Riesgo conocido

Si algún ambiente tuviera `20260812090000` ya aplicada con el contenido viejo, mostraría divergencia. Se verificó antes que en la base actual no está aplicada; el no-op es la vía segura.
