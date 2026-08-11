# Facturas eliminadas siguen apareciendo como vencidas

## Qué está pasando

Las 6 facturas que ves (726-DUP-*, 755-DUP-fe48bee7, 848, 900-DUP-c741c8c7) **ya fueron borradas lógicamente** (tienen fecha de borrado del 6 y 10 de agosto; son duplicados legacy de respaldo). Es decir: la papelera ya se usó, pero varias pantallas siguen leyéndolas como si estuvieran vivas.

Analogía: tiraste unos papeles al cesto de basura, pero el reporte de pendientes sigue contando lo que hay en el cesto.

Confirmado en base de datos: 6 facturas con estado `Vencida` y borrado lógico activo. La consulta de cobranza (`fetchCobranza`) no excluye las borradas, por eso aparecen en "Vencidas", en los KPIs y en el Aging.

No hace falta cambiar datos: las facturas ya están correctamente marcadas como borradas. Lo que hay que corregir es el filtro de lectura.

## Alcance de la corrección

Excluir facturas borradas en todos los puntos de lectura que hoy las incluyen:

- Cobranza / bandeja "Vencidas" y "Por cobrar" (origen del problema reportado)
- Contadores de las pestañas de Facturación (Por timbrar, Por enviar, Emitidas, etc.)
- Listado maestro de facturas
- Estado de cuenta por cliente y financieros del cliente
- Exportaciones de cartera / Aging (CSV y PDF)
- Detección de "hueco de facturación" y dashboard de dirección

También se corrige el conteo de la alerta del sidebar si depende de estas mismas consultas.

## Cómo evitar que se repita

Agregar una prueba de arquitectura que revise todas las consultas de lectura sobre la tabla de facturas y falle si alguna omite el filtro de borrado lógico, igual que ya se hace con otras reglas del proyecto.

## Detalle técnico

- Root cause verificado: `src/features/facturacion/services/cobranza.ts` (`fetchCobranza`, línea ~119) filtra por `estado` pero no aplica `.is("deleted_at", null)` sobre `facturas`. El filtro sí se aplica a `pagos_factura` y `factura_notas_credito`, no a la factura misma.
- Archivos con `from("facturas")` de lectura sin filtro de `deleted_at` (a corregir): `facturacion/services/cobranza.ts`, `facturacion/services/bandejas.ts` (líneas 48, 69, 135, 142, 153, 159), `facturacion/services/shared/fetchFacturas.ts`, `facturacion/services/exports.ts` (41, 84), `facturacion/estadoCuenta/services/estadoCuenta.ts`, `facturacion/services/huecoFacturacion/fetchSources.ts:129`, `cliente/services/financials.ts`, `portal/services/queriesFacturas.ts` (20, 52), `profit/services/estadoResultadosDevengado.ts:77`.
- No se tocan rutas de escritura ni las que leen una factura por id para editarla/sustituirla (`detail.ts`, `sustitucionEstado.ts`, `recalcularTotalesFactura.ts`), donde ver el registro borrado es intencional.
- Sin migración ni cambio de datos: los 6 registros quedan como están (borrado lógico).
- Tests: unitarios de `fetchCobranza` y `bandejas` verificando que se solicita el filtro, más el test de arquitectura descrito arriba.
- Registrar en `CHANGELOG.md` y subir `APP_VERSION`.
