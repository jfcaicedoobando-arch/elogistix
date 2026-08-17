# Parche 7 — Reportes sin IVA, EERR, comisiones al cierre y portal público

Aplicar el parche `patch-7-sql-reportes-eerr-portal.patch` (BL-06, BL-07, BL-09, BL-10, BL-11, BL-13).

## Qué cambia para el usuario

1. **Estado de Resultados (devengado) sin IVA** — ingresos y costos se toman del subtotal de facturas de venta y de proveedor, para que el resultado coincida con la vista por conceptos.
2. **Presupuesto vs Real más fiel** — el real se calcula sin IVA, descuenta notas de crédito de proveedor aplicadas, y muestra un aviso cuando el periodo consultado alcanza el límite de filas (el dato podría estar incompleto).
3. **Comisiones al cerrar embarque** — al cerrar, se recalculan las comisiones que quedaron marcadas como pendientes; si una falla, deja aviso y no bloquea el cierre. El resultado del cierre reporta cuántas se recalcularon.
4. **Notas de crédito en el periodo correcto** — se ubican por su fecha de emisión, no por la última edición, así ya no cambian de mes al editarlas.
5. **Portal público de proforma** — con liga expirada o ya respondida deja de mostrar montos y conceptos; sólo se muestra un aviso con el estado.
6. **Cobro en lote de clientes sin bloqueos** — los cobros en lote toman los candados de las facturas en un orden fijo, eliminando el riesgo de que dos lotes simultáneos se traben entre sí.

## Detalles técnicos

- Aplicar el parche con `git apply` (14 archivos TS/TSX + tests).
- TS: `estadoResultadosDevengado.ts`, `estadoResultadosBuckets.ts`, `estadoResultadosRows.ts` (`total` → `subtotal`, NCs por `fecha_emision`); `vsReal.ts` / `vsRealDomain.ts` (subtotal, nueva fuente `proveedor_notas_credito` con embed a la factura padre y bandera `real_truncado`); `TabVsReal.tsx` (aviso de truncamiento); `PortalProforma.tsx` (elimina `AlertaRespondida`, usa `AvisoAccionable`).
- SQL: las 3 migraciones del parche no se dejan como archivos sueltos; se ejecutan con la herramienta de migraciones del backend, en este orden:
  1. `CREATE OR REPLACE cerrar_embarque` con recálculo de comisiones 'Devengada' con `nota IS NOT NULL` por bloque EXCEPTION individual y `comisiones_recalculadas` en el jsonb.
  2. `CREATE OR REPLACE portal_obtener_proforma_por_token` (STABLE SECURITY DEFINER): con `estado_link <> 'activo'` regresa sólo `estado_link` + `proforma{id, numero}` + `conceptos: []`; grants anon/authenticated reafirmados.
  3. `CREATE OR REPLACE registrar_pago_cliente_lote` con el loop de locks `ORDER BY (r->>'factura_id')::uuid`; grants FIX-H6-12 reafirmados.
  Se conservan las fuentes canónicas en `supabase/schema/**` que el parche actualiza 1:1, borrando los archivos duplicados de `supabase/migrations/` que trae el parche.
- Verificación: `bunx vitest run` de los suites tocados (`vsReal.*`, `estadoResultados*`, `alertas`) + typecheck.
- Riesgos residuales aceptados y documentados en el CHANGELOG: las notas de crédito (cliente y proveedor) se descuentan con IVA porque esas tablas no guardan subtotal; el EERR devengado sigue sin descontar NCs de proveedor (queda como follow-up).
- Bump de `APP_VERSION` a `13.637.0` y entrada en `CHANGELOG.md`.
