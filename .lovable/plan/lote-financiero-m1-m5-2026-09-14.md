# Lote financiero M1–M5

Cinco correcciones de integridad: que los desgloses cuadren con sus totales, que "hoy" sea siempre el día en México, y que las comisiones ya pagadas se recuperen de forma parcial y auditable sin descontarse dos veces.

## M1 — El desglose de venta debe cuadrar con la venta real

Hoy el total de venta ya resta la nota de crédito, pero el desglose por concepto suma las líneas de la factura sin restarla, así que "las partes" no suman "el total".

Se agrega al desglose una línea visible `(nota de crédito)` con importe negativo, calculada con el mismo CTE `fnc` que ya usa el total: primero se convierte la nota a la moneda de la factura y después se aplica el factor de reparto entre embarques.

Pruebas: factura en pesos con nota en dólares, y factura repartida 100/200 entre dos embarques; en ambos casos la suma del desglose cuadra al centavo con la venta real.

## M2 — El desglose de costos debe cuadrar con el costo real

Mismo problema del lado de proveedores. Se agrega la línea negativa `(nota de crédito proveedor)` usando el importe ya convertido de `pnc` y la misma proporción base gravable/total que emplea el total de costo. Los seguros se siguen sumando como hoy.

Prueba: nota de crédito de proveedor en moneda distinta; la suma del desglose cuadra con el costo real.

## M3 — "Hoy" es la fecha de México, sin excepciones

Varios procesos usan el mayor entre la fecha de México y la fecha UTC. Después del cambio de día en Londres eso deja registrar "mañana" desde México. Se cambia a la fecha de México estricta mediante un ayudante único, y se aplica en:

- traspaso entre cuentas,
- pago individual a proveedor (RPC y candado de la tabla),
- cobro de cliente en lote,
- pago programado,
- pago de liquidación de comisión,
- pago a proveedor en lote (comparte el mismo canon; se alinea para no dejar dos reglas distintas).

Se conservan los límites por fecha de emisión y por corte bancario. Prueba: una fecha que en México es mañana pero en UTC ya es hoy debe rechazarse.

## M4 — Recuperación parcial de comisiones, con rastro

Cuando una vendedora debe 150 y en el periodo devengó 100, hoy el sistema omite la deuda y le paga los 100 completos. Debe pagarse 0 y quedar 50 pendientes por recuperar.

- La liquidación descuenta de cada deuda **la porción que alcance**, de la más antigua a la más reciente.
- Cada porción se guarda como un renglón propio (liquidación, comisión, importe), de modo que el monto original de la comisión nunca se sobrescribe y no puede recuperarse dos veces: lo ya recuperado se descuenta al calcular lo que queda.
- La comisión sólo queda cerrada cuando se recuperó por completo; si fue parcial sigue "Por recuperar" con el resto.
- Cancelar una liquidación revierte **solamente sus propias porciones** y respeta la regla actual de que una comisión cancelada vuelve a "Por recuperar".

Sin pantallas nuevas.

## M5 — Dos liquidaciones al mismo tiempo

Dos liquidaciones simultáneas de la misma vendedora leen la misma deuda y ambas la descuentan. Se serializa por organización y vendedora al inicio del proceso, de forma que la segunda espera a la primera; la idempotencia actual se conserva. Prueba: una deuda de 50 se descuenta una sola vez bajo intentos concurrentes.

## Detalles técnicos

- `pnl_financiero_embarque`: en `por_concepto` se agrega `UNION ALL` con `-sum(fnc.monto)` convertido a MXN con `f.tc_doc`; en `por_concepto_costo`, `-sum(pnc.monto) * (base_gravable/total)` con `pf.tc_doc`. Sin cambios en los KPIs ni en importes guardados.
- Nuevo `public.fecha_negocio_mx()` (STABLE, `search_path` fijo, `REVOKE`/`GRANT` H6) para reemplazar `GREATEST((now() AT TIME ZONE 'America/Mexico_City')::date, CURRENT_DATE)` y los `CURRENT_DATE` de los RPCs listados.
- Nueva tabla `public.comisiones_recuperaciones` (`organization_id`, `liquidacion_id`, `comision_id`, `monto_mxn`, timestamps) con `GRANT` explícitos, RLS por organización y unicidad `(liquidacion_id, comision_id)`; `generar_liquidacion_comision` la escribe y `cancelar_liquidacion_comision` revierte sólo las suyas.
- `generar_liquidacion_comision`: `pg_advisory_xact_lock` sobre `(organization_id, vendedora_id)` antes de leer devengadas y deudas; lock único, sin riesgo de interbloqueo.
- Nuevos códigos `LC_*` si aplican, con su mensaje en español en `src/lib/errors/`.
- Migraciones + espejos en `supabase/schema/` 1:1, `migration-manifest`, versión y CHANGELOG; pruebas SQL enfocadas en `supabase/tests/` con nombres únicos. Sin CI/RLS local.
