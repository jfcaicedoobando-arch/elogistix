## Contexto

El documento subido trae 14 hallazgos de severidad media (M1–M14) con diffs propuestos. Verifiqué una muestra contra el repo real y coincide: 111 archivos con marcadores `SAFE-CAST`, 11 `useQuery` inline en `components/`, borrado duro de proveedores (`proveedoresCrud.ts:148`), dos motores de redondeo conviviendo en facturación (`Math.round` en `recalcularTotalesFactura.ts:39` / `conceptosFacturaCrud.ts` vs currency.js), `nuqs` ya instalado y sin `p-limit`.

No aplicaré los diffs a ciegas: cada FIX se re-verifica contra el archivo real antes de tocarlo (el propio documento admite 2 falsos positivos ya corregidos).

## Olas

### Ola 1 — Dinero y consistencia numérica (mayor riesgo real)
- **M3**: helper canónico `roundMoney` en `src/lib/financial/financialUtils.ts` con semántica "half away from zero" (igual que Postgres), sustituyendo los `Math.round(n*100)/100` de facturación y el acumulado flotante de notas de crédito.
- **M4**: aplicar zod (schema extendido con `conceptoVentaSchema`) a `updateCotizacion`, que hoy escribe montos sin validación.
- **M11**: parser fiscal de conceptos unificado en `src/lib/domain/facturaConceptos.ts` y totales de cotización sin descarte silencioso.
- Tests unitarios de redondeo (incluye negativos), validación y parser.

### Ola 2 — SQL (4 migraciones independientes)
- **M5**: sincronización de los espejos `cliente_nombre` (cotizaciones/embarques/facturas) y pares `naviera`/`naviera_id`, `agente`/`agente_id`.
- **M6**: `deleted_at` en tablas de dinero que no lo tienen (proveedores, comisiones, liquidaciones, movimientos BBVA, garantías), índice único de RFC excluyendo borrados, y cambiar el borrado duro de proveedores por soft-delete en el frontend.
- **M7**: `organization_id` propio en `costeo_tarifa_recargos` y `costeo_naviera_demoras_tarifa` + policies simplificadas (aislamiento y rendimiento).
- **M13**: CHECK de estados en `cotizacion_envios`, `proforma_envios`, `factura_envios`.
- Cada migración con GRANTs/policies explícitos y prueba en la suite RLS.

### Ola 3 — Seguridad backend (M8)
`seed_demo_organization` restringida, cron protegido con `X-Cron-Secret` y validación de destinatario en los correos de CxC/cotización.

### Ola 4 — Rendimiento y experiencia
- **M12**: helper `mapWithConcurrency` y acciones masivas de facturas (ZIP/email) con concurrencia limitada y contador de progreso.
- **M9**: perfil/organización migrado de contexto manual con TTL a TanStack Query, con invalidación desde las mutaciones admin (arregla el nombre de org desactualizado en el sidebar).
- **M10**: filtros de CxP en la URL con `nuqs`, sin pisar la captura en curso.

### Ola 5 — Higiene arquitectónica
- **M14 Ola 1**: extraer a hooks los 3 casos de dinero (`ConciliacionPagoCell`, `TabDemoras`, `ProformaInconsistenteAlert`) y test anti-regresión con baseline decreciente. Las olas 2–3 del propio M14 (resto de hooks y movimientos de archivos) quedan como seguimiento.
- **M1**: test de frescura de marcadores `SAFE-CAST` contra `types.ts` y borrado de los 4 obsoletos.
- **M2**: adopción de `fromDb(data, schema)` en los hotspots de dinero + métrica de adopción.

## Detalles técnicos

- Migraciones en el bloque `20260730300xxx`, nombre `YYYYMMDDHHMMSS_<uuid>.sql`, con GRANT + RLS explícitos para pasar `audit:migrations` (H4/H6) y el radar de drift en base limpia.
- Tras cada ola: `bun run lint --max-warnings 0`, `bunx tsc -b`, tests afectados y los tests de arquitectura (límite de 200 líneas por archivo).
- Los nuevos códigos `LC_*` que introduzcan las migraciones necesitan su mensaje en `lcCodeMessages.*` (lo exige el test de cobertura de errores).
- `CHANGELOG.md` + `APP_VERSION` se actualizan al cierre de cada ola.

## Fuera de alcance

- Olas 2 y 3 de M14 (extracción masiva del resto de hooks): se dejan documentadas con la baseline del test para bajarla después.
- Los 2 falsos positivos ya descartados (`clientes.estado`, `embarques.cobro_cliente_status`).
