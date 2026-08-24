# Auditoría de `fix2-db.diff` — qué es bug real y qué no

## Veredicto

**B-1 · Fuga de datos internos al portal del cliente — REAL (severidad alta).**
La política `Cliente read own embarques` da acceso a la **fila completa** de `embarques`. El portal hoy pide sólo columnas seguras (buena práctica), pero eso es cortesía del frontend: un usuario del portal, con su propio token, puede pedir `select=*` y leer `cerrado_snapshot` (snapshot de utilidad al cierre), `tarifa_delta_jsonb` (deltas de tarifa/costo), `notas`, `reabierto_motivo` y `created_by_email` (correos internos del staff). Postgres no filtra columnas con RLS.

**B-2 · Máquina de estados de notas de crédito inconsistente — REAL (bug latente y bloqueante).**
Verificado en base:
- Trigger en BD: `Borrador → {Aprobada, Cancelada}` (no admite `Timbrada`).
- Edge `facturapi-emitir-nota-credito` escribe `estado: "Timbrada"` directo.
- UI (`FacturaNotasCreditoTable`) sólo muestra "Timbrar" cuando el estado es `Borrador`, y no existe acción "Aprobar".

Resultado: el primer timbrado de NC desde la app fallaría con `LC_NC_TRANSICION_INVALIDA` **después** de haber timbrado en FacturApi (queda el CFDI vivo sin registro). Hoy no ha estallado porque no existe ninguna NC en la base todavía. Además el frontend prohíbe `Aplicada → Cancelada`, que la BD sí permite.

**B-3 · Permisos de cotizaciones — PARCIALMENTE real.**
El parche dice que la función "rechazaba a vendedor": falso, `vendedor` ya está. Lo real: la función incluye `operador` (no está en el canon `SALES`) y **omite `admin_org`**, que es el rol de dueño de organización. Un `admin_org` sin rol legado `admin` no puede escribir cotizaciones.

## Lo que NO voy a aplicar del parche

El parche resuelve B-1 creando una tabla compañera `embarques_interno` con migración de datos y triggers de sincronización. Es un cambio invasivo (doble escritura, riesgo de desincronización) para un problema que se resuelve con privilegios de columna. Descartado.

## Qué haré

### 1. Sellar la fuga del portal (B-1) sin partir la tabla
- `REVOKE SELECT (cerrado_snapshot, tarifa_delta_jsonb, notas, reabierto_motivo, created_by_email) ON public.embarques FROM authenticated, anon`.
- Crear vista `public.embarques_interno_v` (owner del esquema, sin `security_invoker`) que expone esas columnas **sólo** a staff de la organización (validación por rol interno + membresía); `GRANT SELECT` a `authenticated`.
- Repuntar los consumos internos a la vista: `services/tarifaInfo.ts`, `services/reconciliacion3Columnas.ts`, `services/columns.ts`, `EmbarqueDetalleTabs.tsx` (creado por) y `TabResumen.tsx`.
- Prueba de regresión SQL: un usuario `cliente` recibe error de permisos al pedir esas columnas; un operador de la misma org sí las lee por la vista.

### 2. Unificar la máquina de estados de NC (B-2)
- Canon único: `Borrador → {Timbrada, Cancelada}`, `Timbrada → {Aplicada, Cancelada}`, `Aplicada → {Cancelada}`, `Aprobada` legado sólo de salida.
- Actualizar `guard_nc_cliente_transicion()` en BD y `asegurarTransicion()` en `services/notasCredito.ts` para que sean espejo exacto.
- Prueba SQL de las transiciones válidas e inválidas.

### 3. Alinear permisos de cotizaciones (B-3)
- Re-emitir `puede_escribir_cotizaciones()` como espejo exacto de `SALES`: entra `admin_org`, sale `operador`.
- Confirmar que ninguna pantalla de operaciones dependa de escribir cotizaciones antes de retirar `operador`; si alguna lo hace, lo reporto y no lo retiro en esta entrega.

## Notas técnicas
- Migraciones nuevas + migración espejo posterior (política del proyecto contra replays) y sincronización de `migration-manifest.json`.
- Bump de `APP_VERSION` y entrada en `CHANGELOG.md`.
- Suites a correr: RLS/pgTAP nuevas, `bunx vitest run` de arquitectura y de facturación, lint.
