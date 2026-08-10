# Ola 3 complemento — 6 regresiones medias + 14 bajas

Verifiqué los puntos clave contra el código real: RG4 (`validarTotalNoMenorAPagado` sigue sumando `monto` crudo), RG5 (`parseMonto` no normaliza coma decimal), RG6 (`Layout.tsx` no consume `loading` del contexto), RG7/RG19/RG21 (`OrganizationContext` sin try/finally, con dos `queryClient.clear()` y `.catch(() => undefined)` silencioso), RG8 (los canónicos en `supabase/schema/` conservan `<>` en lugar de `IS DISTINCT FROM`), RG14 (`sin_tc: tcUsd === 0` sin mirar la moneda de los conceptos) y RG18 (la edge de TC ya expone `esFallback`, falta cubrir la respuesta 200 parcial). El resto se implementará siguiendo los diffs del documento, validando cada archivo antes de tocarlo.

## Capítulo 1 — Regresiones medias

1. **RG4 · CxP:** el guard de edición usará `sumarPagosEnMonedaFactura` (`COALESCE(monto_en_moneda_factura, monto)`), igual que el listado. Las notas de crédito siguen sumándose en la moneda de la factura.
2. **RG5 · Montos:** `parseMonto` interpreta la coma como decimal cuando queda una sola coma y ningún punto ("19,55" → 19.55), sin romper "1,250.50" ni "15,000".
3. **RG6 · Layout:** mientras el contexto de organización carga se muestra el skeleton, no la pantalla "Elige la organización".
4. **RG7 · Organizaciones:** carga con try/catch/finally, estado `errorOrganizaciones` y botón "Reintentar" en `SeleccionaOrganizacion`.
5. **RG8 · Canónicos SQL:** alinear `convertir_proformas_a_factura.sql` y `crear_embarque_borrador_core.sql` a `IS DISTINCT FROM` (fail-closed cuando la org del usuario es NULL).
6. **RG9 · Tenant elegido:** el arranque respeta el tenant activo del servidor en lugar de machacarlo con el guardado local del navegador.

## Capítulo 2 — Regresiones bajas

- **RG10** `eliminar_proforma_rpc`: bloquear sólo por factura viva o estado 'facturada', no por folio externo huérfano.
- **RG11** `guard_estado_cotizacion`: quitar 'Aceptada' de la reactivación directa (la aceptación mantiene su flujo con snapshot).
- **RG12** `reactivar_cotizacion_rpc`: al volver a 'Enviada' con vigencia expirada, prorrogar a `CURRENT_DATE + 7`.
- **RG13** `convertir_lead_rpc`: restaurar el fallback de `vendedor_email`.
- **RG14** Badge "Sin TC" sólo cuando hay conceptos USD/EUR sin su tipo de cambio.
- **RG15** Abono cross-moneda: propagar el resultado y avisar "Pago registrado, pero no se generó el movimiento bancario".
- **RG16** RPC de tarifas: permitir limpiar campos opcionales (distinguir "no enviado" de "enviado vacío").
- **RG17** `useEnvioDocumentoForm`: no pisar lo capturado cuando el cliente no tiene contactos y dejar de mutar el ref en render.
- **RG18** Respuesta 200 parcial de la edge de TC marca `esFallback`.
- **RG19** Un solo `queryClient.clear()` por cambio de tenant, sin carrera.
- **RG20** Estabilizar `setDateFrom`/`setDateTo` en `useTableFilters` (dependencias del `useCallback`).
- **RG21** `setSuperAdminOrg`: registrar el fallo en el logger y avisar, en vez de tragarlo.
- **RG22** Migración que verifica que la reescritura de `org_scope()` cubrió todas las funciones esperadas y falla ruidosamente si no.
- **RG23** Allowlist e2e: rechazar dominios desechables por defecto.

## Detalles técnicos

- Migraciones nuevas con timestamp real (`YYYYMMDDHHMMSS_rgNN_*.sql`), `SECURITY DEFINER` + `SET search_path = public`, errores `LC_*`, y `REVOKE ... FROM PUBLIC` + `GRANT EXECUTE ... TO authenticated, service_role` al final (requisito del auditor H6).
- Nuevos códigos `LC_*` se agregan al diccionario `lcCodeMessages` para no romper `lcCodeCoverage.test.ts`.
- Archivos tocados se mantienen bajo 200 líneas (Power of 10); si `OrganizationContext.tsx` se pasa, la lógica del super admin se extrae a un hook vecino.
- Tests: actualizar/añadir casos en `parseMonto`, guard de CxP cross-moneda, `sin_tc` (MXN vs USD), `useRegistrarPagoSubmit`, `useEnvioDocumentoForm` y los SQL de `supabase/tests/` afectados.
- Cierre: `bunx vitest run` de los módulos tocados + auditorías (`audit:migrations`, arquitectura), bump de `APP_VERSION` y entrada en `CHANGELOG.md`.

## Fuera de alcance

Los pendientes del paquete anterior (migraciones de datos RG1c/RG3a y la purga de `.env` del historial de git) no se incluyen aquí.
