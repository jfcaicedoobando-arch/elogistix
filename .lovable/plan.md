# Ola 1 — "Candados de horas"

Primera ola del plan de major release (`olas_release.md`). Objetivo: cerrar el P0 de seguridad y los huecos de idempotencia más baratos. Una sola migración SQL + toques puntuales de frontend. Las olas 2-8 quedan para turnos siguientes, una por vez.

## Qué se arregla y por qué

Hoy hay funciones de base de datos que cualquier usuario con sesión puede ejecutar sin comprobar a qué organización pertenece el dato. Es como una puerta con chapa pero sin verificar la credencial: entra cualquiera que ya esté en el edificio. Además, algunos botones (pago programado, avance de estado) pueden registrar el mismo movimiento dos veces si se da doble clic.

## Bloque A — Migración de seguridad y consistencia (una migración)

1. `revertir_proforma_al_cancelar_sustitucion` (P0): exigir sesión, validar pertenencia a la organización del dato y rol de escritor financiero; caso nuevo en `supabase/tests/rls/test_rls_cross_tenant_mutations.sql`.
2. `limpiar_cancellation_status_verificado`: comparar `organization_id` de la factura contra la org del usuario (excepción `super_admin`), mismo patrón que `aprobar_factura_proveedor`.
3. `registrar_comision_pendiente`: quitar ejecución a `authenticated`, dejar `service_role`.
4. `tc_dof_upsert_manual`: restringir a `super_admin` y registrar en bitácora (es un tipo de cambio global, no de un tenant).
5. `archivar_version_cotizacion`: validar pertenencia a la org y permiso de escritura en cotizaciones.
6. `assert_factura_viva_para_pago`: quitar el `EXECUTE` a `anon` (hoy lo tiene), bajar tolerancia de sobrepago de 0.01 a 0.005 y usar el saldo convertido de la factura en lugar de sumar notas de crédito en crudo (caso factura USD + NC MXN).
7. `registrar_pago_proveedor_lote`: ordenar y bloquear filas igual que el espejo de CxC, para evitar bloqueos mutuos en pagos por lote.
8. `generar_liquidacion_comision`: agrupar el periodo por hora de Ciudad de México, no UTC.
9. Trigger BEFORE en `pagos_factura` que valide la fecha de pago con las mismas reglas que ya aplica el cobro en lote.
10. Triggers `updated_at` faltantes en las tablas mutables pendientes.

Cada punto queda con su archivo fuente en `supabase/schema/**` y su prueba (pgTAP o suite RLS) en la misma ola.

## Bloque B — Frontend (idempotencia y copy)

11. `ejecutarPagoProgramado.ts`: generar un identificador de intento por apertura del diálogo y enviarlo a la RPC (patrón ya usado en el cobro en lote), para que el doble clic no duplique el pago.
12. `useEmbarqueEstadoActions.ts`: identificador de intento estable al avanzar el estado del embarque.
13. `pgConstraintMessages.ts`: mensajes en español para los conflictos de `client_request_id` en pagos de cliente y de proveedor ("Este cobro ya se registró…") + prueba del catálogo.
14. UI trivial en commit aparte: `aria-label` en `SidebarTrigger`, copy de conciliación sin "(conceptos_costo)", encabezado "VENCE EN" sin salto de línea, columna NETO visible en tesorería, verde de la tarjeta de Anticipos sólo cuando hay datos.

## Fuera de alcance de esta ola

- Validar los constraints `NOT VALID` y poner límites a los buckets de Storage: requieren ventana de mantenimiento y reporte previo de violaciones; se agendan aparte.
- Comisiones (Ola 2), pulido visual (Ola 3), automatizaciones (Olas 4-5), CRM (6-7) y cambios estructurales (8).

## Criterio de salida

CI verde (lint, tipos, tests, suites RLS y pgTAP), pruebas nuevas pasando, ninguna función SECURITY DEFINER con permiso a `anon` fuera de la whitelist, y `CHANGELOG.md` + `APP_VERSION` actualizados.
