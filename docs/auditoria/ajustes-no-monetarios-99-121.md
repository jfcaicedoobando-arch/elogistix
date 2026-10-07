# Ajustes no monetarios: ampliaciones 99/121

## Alcance local

Base del candidato: `ec62b370baf09ea42bc41b101de547d2325163db` (aplicación 13.824.36).
Copy 24 ya está integrado mediante [PR177](https://github.com/jfcaicedoobando-arch/elogistix/pull/177); este cambio no lo repite.

- El libro identifica `es_ajuste=true` como **Ajuste no monetario**, con
  conciliación **No aplica**; el ajuste queda fuera de los filtros Pendientes y
  Conciliados. Permanece visible en Todos y conserva su importe documental.
- Exportación CSV/PDF consume la misma clasificación. No cambia el diseño PDF.
- El detalle muestra **Importe ajustado**, sin llamarlo dinero pagado ni pedir
  movimiento bancario o tipo de cambio para el ajuste.
- Los KPIs ya excluían ajustes; no se modifica su cálculo. Los pagos normales,
  efectivo, devoluciones, aplicaciones de anticipos, REP y filtros conservan su
  comportamiento previo.

## Historial y compatibilidad

La migración `20261007023000_audit99_121_historial_ajustes_no_monetarios.sql`
es DDL: reemplaza exclusivamente la función lectora
`historial_proveedor_factura(uuid)` mediante `CREATE OR REPLACE`.

- Conserva firma, tipos de retorno, `tipo='pago'`, owner, ACL, autenticación y
  alcance de organización. No utiliza `DROP` ni cambia permisos.
- La descripción distingue ajustes a partir de `pagos_proveedor.es_ajuste`.
  Agrega al JSON los valores reales `pago_id`, `es_ajuste` y `motivo_ajuste`.
- No interpreta referencia, método ni bitácora genérica como prueba de ajuste.
- No cambia importe, moneda, fecha de negocio, timestamp o actor; no contiene
  DML de negocio, backfill ni reescritura de eventos anteriores.
- El cliente cambia el icono y la etiqueta de fecha sólo para el booleano
  `es_ajuste=true`. Un servidor anterior conserva el comportamiento anterior,
  sin inferencias. El historial corregido requiere aplicar el DDL.

## Verificación

- 91 pruebas en 17 archivos aprobadas durante la validación del código funcional;
  typecheck, lint focal y build aprobados.
- 11 auditorías estáticas aprobadas. `audit:manifest` queda bloqueado por el
  empaquetado futuro descrito abajo. `audit:soft-delete` conserva las mismas
  ocho lecturas y una entrada obsoleta reproducidas en main; no se alteró esa
  deuda para encubrirla.
- Pruebas de dominio y componentes: ajustes, filtros, exportación, dinero
  ordinario, REP, efectivo, monedas MXN/USD/EUR, cierre y reapertura del detalle
  y del editor, historial tipificado y compatibilidad con metadatos anteriores.
- Guard SQL nuevo registrado en `_guards_manifest.txt`: cuatro motivos de
  cierre, pago ordinario con referencia engañosa, baja lógica, otro tenant,
  ACL, ausencia de movimiento y comparación de registros antes/después de leer.
- Replay desde squash sobre PostgreSQL 17.9 aislado; guards de permisos,
  cobertura e integridad, suites de historial/fecha/99/121 y RLS de historial.
- Baseline generado con servidor 17.9 y cliente `pg_dump` 17.11: el diff sólo
  contiene la descripción y los tres campos JSON de la función modificada.

No se ejecutó SQL remoto, no se modificaron FP12/FP29, no se desplegó ni publicó.
La comprobación GUI en el entorno publicado queda pendiente de la entrega.
La duplicación similar del chip/resumen de captura manual queda fuera de este
cambio y del editor ya entregado en copy 24.

## Seguimiento de revisión: móvil

- La tarjeta móvil reutiliza `etiquetaTipoPagoLibro`, muestra el badge neutro
  **Ajuste no monetario** y **Importe ajustado**. Pagos ordinarios conservan sus
  etiquetas y resaltado; ningún importe se recalcula.
- El nombre accesible del registro usa la misma clasificación. El botón móvil
  de `ResponsiveDataTable` ahora aplica el `getRowAriaLabel` ya disponible en
  su contrato; sin callback conserva el nombre derivado del contenido.
- Nueve pruebas adicionales cubren tarjeta, pantalla real con wrapper móvil,
  selección del mismo id/tipo de detalle, fallback accesible y rol de enlace.
- Este seguimiento no cambia SQL ni reemplaza los commits anteriores.

## Empaquetado pendiente: manifiestos publicados congelados

- El identificador SQL `20261007023000` es **provisional y no aplicado**. Debe
  confirmarse al reservar la futura versión/envelope; no se asigna una nueva
  versión en este candidato.
- `supabase/releases/migration-manifest.json` permanece byte por byte idéntico
  a main `ec62b370`, incluida la entrada publicada 13.824.36. No se cambian
  entradas antiguas ni archivos de `supabase/releases/history/`.
- Por diseño, `audit:manifest` falla al encontrar el nuevo SQL fuera del
  inventario congelado. No se modifica la versión 36 ni el guard para obtener
  un verde artificial. El draft queda pendiente de un futuro manifiesto de
  release autorizado y de la prueba conjunta de ese envelope.
- La nueva suite SQL sí está registrada en `supabase/tests/_guards_manifest.txt`.
  La autorización para preparar código y el PR no aplica SQL en una BD remota.
- Composición del wrapper con fix 54: seis pruebas aprobadas, preservando tanto
  el tipo `TableOptions` como el atributo accesible del botón móvil. La etiqueta
  larga también se revisó en píxeles en el nuevo PDF junto a un folio completo.
