# Ola D — Bloque P2 de dinero: parches SQL 10 a 18

Los 7 documentos subidos traen parches ya redactados (espejo en `supabase/schema/**` + migración nueva). Verifiqué en el código actual que **ninguno está aplicado todavía**:

- `avanzar_estado_embarque.sql` no tiene `FOR UPDATE` ni `LC_ESTADO_CONCURRENTE`.
- `validar_cierre_embarque.sql` sigue comparando `v_cxp_saldo <= 0.01` y `v_cxc_saldo <= 0.01` (suma multi-moneda).
- `registrar_pago_cliente_lote.sql` sigue con tolerancia `0.009`.
- `convertir_proformas_a_factura.sql` sigue recalculando con `SUM(cantidad * precio_unitario)`.
- `adjuntar_xml_factura_entrante.sql` no valida `p_uuid_fiscal` ni `p_total_detectado`.
- `cotizacion_totales_conceptos` sólo existe en migraciones (sin espejo canónico).
- Las 3 entradas del baseline de `audit:replay-mirror` que el parche 00 elimina siguen presentes.

## Qué se va a corregir (en lenguaje llano)

| Parche | Problema hoy | Después |
| --- | --- | --- |
| BUG-10 | Doble clic puede cambiar el estado de un embarque dos veces y saltarse la máquina de estados | La fila se bloquea y la segunda llamada falla con aviso claro |
| BUG-11 | Un concepto en EUR suma 0 a la cotización, en silencio | Moneda no soportada lanza error explícito |
| BUG-13 | El cierre de embarque suma pesos con dólares para decidir si ya no hay saldo | El umbral se evalúa por moneda |
| BUG-15 | Cobro en lote acepta sobrepagos de hasta 0.009 que el trigger rechaza después | Misma tolerancia (0.005) en RPC y trigger |
| BUG-17 | Al convertir proformas, los renglones no cuadran con el encabezado por redondeo | Total del renglón redondeado y encabezado recalculado desde ese total |
| BUG-18 | El buzón guarda UUID/total del CFDI tal como los manda el navegador | Validación mínima server-side (formato UUID, total > 0) |
| SQL-00 | Guardrail de espejos queda con entradas muertas tras BUG-10 y BUG-17 | Se limpian esas 3 entradas del baseline |

## Ejecución

1. **Aplicar los 6 parches** tal como vienen en los documentos: editar los espejos de `supabase/schema/**` y crear las 7 migraciones `20260826000100` a `20260826000600` (BUG-17 trae dos).
2. **Limpiar el baseline** `scripts/audit-replay-mirror-baseline.json` (parche 00) y dejar salto de línea final.
3. **Pruebas de regresión SQL nuevas** en `supabase/tests/`, siguiendo el patrón `DO $$ ... RAISE EXCEPTION '<CLAVE> REGRESIÓN'`:
   - `embarque_avanzar_estado_concurrente.sql` (BUG-10: guarda optimista).
   - `cotizacion_totales_moneda_no_soportada.sql` (BUG-11: EUR lanza error, MXN/USD suman igual que antes).
   - `validar_cierre_umbral_por_moneda.sql` (BUG-13: 0.50 USD pendiente bloquea el cierre aunque MXN esté en 0).
   - `cobro_lote_tolerancia_sobrepago.sql` (BUG-15: 0.007 de sobrepago se rechaza en la RPC, no a mitad del lote).
   - `proforma_conversion_cuadre_renglones.sql` (BUG-17: suma de renglones == encabezado).
   - `adjuntar_xml_validaciones.sql` (BUG-18: UUID basura y total 0 se rechazan).
   Registrar cada archivo como paso nuevo en el job de pruebas SQL de `.github/workflows/rls-tests.yml`.
4. **Revisar el lado cliente de BUG-15**: hay un comentario en la RPC señalando que el frontend usa 0.009. Alinear la tolerancia del cobro en lote en el front al mismo 0.005 para que el mensaje de UI y el de la base coincidan.
5. **Guardrails y verificación**: `npx tsx scripts/audit-replay-mirror.ts`, `bunx tsgo --noEmit`, y la suite de vitest afectada.
6. **Bitácora**: bump de `APP_VERSION` a `13.652.0` y entrada en `CHANGELOG.md` referenciando BUG-10/11/13/15/17/18.

## Notas técnicas

- Las migraciones aplicadas son inmutables: los parches usan `CREATE OR REPLACE FUNCTION` en migraciones nuevas con timestamp `20260826…`, y el espejo de `supabase/schema/**` debe quedar **idéntico** al cuerpo de la migración nueva o el guardrail `audit:replay-mirror` falla.
- `cotizacion_totales_conceptos` seguirá sin espejo canónico (así viene el parche); queda documentado en el comentario de cabecera de la migración.
- BUG-18 deja un `TODO` explícito: la validación fuerte (re-parsear el XML desde Storage y comparar UUID/RFC/total) no entra en este bloque.
- Sin cambios de esquema (no hay tablas nuevas), por lo que no aplica el bloque de `GRANT`.

## Fuera de alcance

Pulido visual P2 (UI-05 a UI-16, UX-10 a UX-16) y el resto de EC-05 a EC-10 quedan para el siguiente bloque.
