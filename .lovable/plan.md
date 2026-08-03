# Correcciones Auditoría E2E R6 (desde v13.389.6)

Plan basado en los dos archivos subidos. Verifiqué en el código y en la base de datos las causas de los fixes 1, 3 y 4.

## FIX 1 (P1) — El pago a proveedor no toca el banco

Hoy `registrarPagoProveedor` solo inserta en `pagos_proveedor`; la UI nunca pide la cuenta bancaria y nunca se crea el movimiento en `bbva_movimientos`, así que el saldo de Tesorería no baja.

- `usePagoProveedorForm`: nuevo estado `cuentaId` + carga de cuentas activas (`useCuentasBancarias`), preselección por moneda del pago, bandera `requiereCuenta` (falsa si el método es Efectivo).
- `PagoProveedorFormBody`: selector "Cuenta bancaria" con error inline cuando falta.
- `DialogRegistrarPagoProveedor`: envía `cuenta_bancaria_id` y bloquea el submit sin cuenta (salvo Efectivo).
- `pagosProveedor.ts`: tras insertar el pago, insertar el movimiento bancario vinculado (`cargo` en MXN usando `tipo_cambio_usd` si aplica, `estado_conciliacion = 'Conciliado'`, `pago_proveedor_id`, `hash_dedupe = 'pago-<id>'`, concepto con folio y proveedor) usando **la misma `organization_id` de la factura** (requisito del trigger `assert_movimiento_pago_consistente`). En `eliminarPagoProveedor`, soft-delete del movimiento vinculado.
- Invalidar las queries de saldos/conciliación de Tesorería al pagar y al eliminar pago.

## FIX 2 (P2) — IVA etiquetado "16%" cuando la tasa efectiva es 0

`ResumenTotalesCotizacion.tsx` sigue con el texto "IVA 16%" hardcodeado en el pie.

- Calcular el IVA por concepto con su `tasa_iva_aplicada` y mostrar la tasa efectiva agrupada ("IVA 16%", "IVA 0%"); si nada aplica IVA, "IVA: 0.00 (conceptos tasa 0/exentos)".
- El pie solo aparece si existen conceptos con `aplica_iva` y tasa > 0, parametrizado con la tasa real.
- Mismo criterio en `PasoResumenCotizacion.tsx` y en el detalle del portal cliente.

## FIX 3 (P2) — Bitácora global en 0 registros

Verificado: la columna `organization_id` ya existe (6,659 de 6,719 filas la tienen), pero las policies SELECT son "solo mis propias filas" o "solo admin de la org". Un miembro no admin ve 0 aunque el historial por entidad sí carga por otra ruta.

- Migración: policy SELECT que permita a cualquier miembro leer la bitácora de **su** organización (vía `organization_members`), conservando la de super_admin. Backfill del `organization_id` faltante donde sea derivable.
- `fetchBitacora`: filtrar por `organization_id` explícito y, en caso de error, mostrar empty-state honesto ("No se pudo cargar la bitácora") en vez de un 0 silencioso.

## FIX 4 (P2) — Login aterriza en una organización demo vacía

Verificado: `get_user_context` devuelve `organization_id` del **primer** `organization_members` sin criterio (`LIMIT 1` sin `ORDER BY`), y `current_user_org_id()` ordena por `created_at`. Con dos membresías, el usuario cae en la org demo vacía.

- Alinear ambas funciones a un criterio único y determinista: preferir la org con actividad reciente (embarques/cotizaciones) y dejar las orgs demo al final.
- En el cliente: persistir la última org elegida por usuario en `safeLocalStorage` y restaurarla al iniciar sesión (hoy `setActiveOrganization` es no-op para usuarios regulares).
- Al cambiar de org, invalidar de forma amplia las queries dependientes de organización para que los módulos refresquen sin recargar (R6-2).

## FIX 5 (P2) — El cliente no se entera de la cotización "Enviada"

El portal lee `notificaciones_cliente`, pero la transición a Enviada no inserta nada ahí.

- En la mutación de estado a `Enviada`, insertar una notificación de cliente ("Nueva cotización enviada" + folio y total, con id de la cotización), reutilizando el patrón de notificaciones de embarque, e invalidar la query del panel del portal.

## FIX 6 (P2/P3) — Lote menor

- Dashboard coordinador: alinear contadores de buckets con los badges del sidebar.
- Portal cliente: contadores de Inicio en 0 y errores de red que exponen HTML crudo (Cloudflare 1033) → mensaje amigable.
- /operaciones: chip "Cerrado" dentro del bucket "Finalizado" → etiqueta consistente.
- Toasts: no exponer nombres de constraints, arreglar "p.m..", desfase de día por zona horaria y enums crudos; date picker del wizard en español.
- Detalle de embarque: `aria-label`/tooltip en botones-icono y timeout con estado de error en cargas largas.

## Notas técnicas

- Todo con `CHANGELOG.md` + bump de `APP_VERSION`.
- Tests: unitarios del nuevo movimiento bancario (mock de cadena Supabase), del cálculo de IVA efectivo y del criterio de org por defecto.
- Sin cambios en `.env`; las migraciones se aplican por el flujo normal del backend.

## Orden sugerido

1. FIX 1 (P1, impacto financiero) → 2. FIX 3 y FIX 4 (visibilidad de datos) → 3. FIX 2 y FIX 5 → 4. FIX 6 según alcance.
