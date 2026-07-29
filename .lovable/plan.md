## Estado actual

La **Ola 1** del paquete M1–M14 ya está aplicada (v13.327.2): M3 (motor único de redondeo), M4 (validación zod al editar cotizaciones) y M11 (parser fiscal canónico + conceptos de cotización que ya no se descartan en silencio).

El documento v2 recién subido coincide con la versión anterior en el alcance restante. Verifiqué contra el repo y la base real antes de planear:

- `proveedores`, `comisiones_devengadas`, `liquidaciones_comision`, `bbva_movimientos` y `embarque_garantias_contenedor` **no tienen** `deleted_at` (consulta a `information_schema`), y `deleteProveedor` (`proveedoresCrud.ts:147`) sigue haciendo `.delete()` físico.
- `costeo_tarifa_recargos` y `costeo_naviera_demoras_tarifa` **no tienen** `organization_id` propio.
- `cotizacion_envios`, `proforma_envios` y `factura_envios` **no tienen** ningún CHECK (`pg_constraint` vacío para contype='c').
- Los 3 marcadores `SAFE-CAST` obsoletos citados existen tal cual en aprobacion.ts:9, proveedoresCrud.ts:62 y useTabProformasController.ts:18.
- `nuqs` ya está instalado; `p-limit` no.

## Olas restantes

### Ola 2 — SQL (4 migraciones independientes, bloque `20260730300xxx`)
- **M5**: espejos `cliente_nombre` (cotizaciones/embarques/facturas) y pares `naviera`/`naviera_id`, `agente`/`agente_id` mantenidos por trigger. El FK manda, el texto es espejo; en `facturas` sólo se propaga en `Borrador` (un CFDI timbrado congela el nombre del receptor). Incluye backfill de divergencias.
- **M6**: `deleted_at`/`deleted_by` + índice parcial en las 5 tablas de dinero; `proveedores_org_rfc_unique` recreado con `AND deleted_at IS NULL`; en el front `deleteProveedor` pasa a soft-delete y las lecturas directas filtran borrados.
- **M7**: `organization_id` propio en las 2 tablas de pricing, con backfill, NOT NULL + FK, trigger que lo fija desde el padre y policies de 1 salto (hoy hacen un JOIN por fila). Se respeta la policy de agentes que sí necesita el join.
- **M13**: normalización previa + CHECK `estado IN ('enviado','parcial','fallido')` en las 3 tablas `*_envios`.

### Ola 3 — Seguridad backend (M8)
`seed_demo_organization` restringida, cron protegido con `X-Cron-Secret` y validación del destinatario en los correos de CxC/cotización.

### Ola 4 — Rendimiento y experiencia
- **M12**: helper `mapWithConcurrency` propio (sin añadir `p-limit`) para las acciones masivas de facturas (ZIP/email), con contador de progreso.
- **M9**: perfil/organización migrado del contexto manual con TTL a TanStack Query, invalidado desde las mutaciones admin (arregla el nombre de organización desactualizado en el sidebar).
- **M10**: filtros de CxP en la URL con `nuqs`, sin pisar la captura en curso.

### Ola 5 — Higiene arquitectónica
- **M14 (ola 1)**: extraer a hooks los 3 casos de dinero (`ConciliacionPagoCell`, `TabDemoras`, `ProformaInconsistenteAlert`) + test anti-regresión con baseline decreciente.
- **M1**: test de frescura de marcadores `SAFE-CAST` contra `types.ts` y borrado de los 3 obsoletos verificados (+ el `;` huérfano de `useTabProformasController.ts`).
- **M2**: adopción de `fromDb(data, schema)` en los hotspots de dinero + métrica de adopción.

## Detalles técnicos

- Migraciones idempotentes, nombre `YYYYMMDDHHMMSS_<uuid>.sql`, con GRANT + RLS explícitos para pasar `audit:migrations` (H4/H6) y el radar de drift en base limpia.
- Cada migración de la Ola 2 se acompaña de su bloque en la suite RLS (`supabase/tests/rls/`).
- Los códigos `LC_*` nuevos requieren su mensaje en `lcCodeMessages.*` (lo exige el test de cobertura).
- Tras cada ola: `bun run lint --max-warnings 0`, `bunx tsc -b`, tests afectados y los de arquitectura (límite de 200 líneas).
- `CHANGELOG.md` + `APP_VERSION` al cierre de cada ola.

## Fuera de alcance

- Olas 2–3 del propio M14 (extracción masiva del resto de hooks): quedan documentadas con la baseline del test.
- Los 2 falsos positivos ya descartados por el propio documento (`clientes.estado`, `embarques.cobro_cliente_status`).
- Cambiar la RPC `proveedores_listado` (pertenece al paquete de críticos/altos).
